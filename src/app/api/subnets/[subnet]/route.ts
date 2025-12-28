import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';
import { isMirrorEquipped } from '~/lib/mirrorUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subnet: string }> }
) {
  try {
    const { subnet: subnetIdParam } = await params;
    const subnetId = parseInt(subnetIdParam, 10);
    
    if (isNaN(subnetId)) {
      return NextResponse.json({ error: 'Invalid subnet ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Get subnet details first to check if it has default access
    const [subnetRows] = await pool.execute<any[]>(
      `SELECT 
        s.id,
        s.name,
        s.description,
        s.image_url,
        s.is_default_access
       FROM subnets s
       WHERE s.id = ?
       LIMIT 1`,
      [subnetId]
    );

    if (subnetRows.length === 0) {
      return NextResponse.json({ error: 'Subnet not found' }, { status: 404 });
    }

    const subnet = subnetRows[0];

    // Check if user has access (either explicit access or default access)
    const [accessRows] = await pool.execute<any[]>(
      `SELECT usa.unlocked_at, usa.unlock_method
       FROM user_subnet_access usa
       WHERE usa.user_id = ? AND usa.subnet_id = ?`,
      [userId, subnetId]
    );

    // If no explicit access and not default access, deny
    if (accessRows.length === 0 && subnet.is_default_access !== 1) {
      return NextResponse.json({ error: 'Subnet not unlocked' }, { status: 403 });
    }

    // Use access data if available, otherwise create default access object
    const accessData = accessRows.length > 0 
      ? accessRows[0] 
      : { unlocked_at: new Date(), unlock_method: 'default_access' };

    // Get unlocked protocols for this subnet
    const [protocolRows] = await pool.execute<any[]>(
      `SELECT 
        p.id,
        p.name,
        p.description,
        p.image_url,
        s.name as subnet_name,
        upa.unlocked_at
       FROM protocols p
       INNER JOIN user_protocol_access upa ON p.id = upa.protocol_id
       LEFT JOIN subnets s ON p.subnet_id = s.id
       WHERE p.subnet_id = ?
         AND upa.user_id = ?
       ORDER BY upa.unlocked_at DESC`,
      [subnetId, userId]
    );

    // Get unlocked terminals/access points (POIs) for this subnet
    const [poiRows] = await pool.execute<any[]>(
      `SELECT DISTINCT
        poi.id,
        poi.name,
        poi.zone_id,
        poi.poi_type,
        poi.type_label,
        poi.description,
        poi.image_url,
        z.name as zone_name,
        uzh.timestamp as unlocked_at
       FROM points_of_interest poi
       INNER JOIN user_zone_history uzh ON poi.id = uzh.poi_id
       INNER JOIN zones z ON poi.zone_id = z.id
       WHERE poi.subnet_id = ? 
         AND uzh.user_id = ? 
         AND uzh.action_type = 'UnlockedPOI'
       ORDER BY uzh.timestamp DESC`,
      [subnetId, userId]
    );

    // Get user's history related to this subnet (discoveries and breaches)
    const [historyRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.action_type,
        uzh.timestamp,
        uzh.end_time,
        uzh.result_status,
        uzh.gains_data,
        uzh.xp_data,
        poi.name as poi_name,
        poi.id as poi_id,
        z.name as zone_name,
        z.id as zone_id
       FROM user_zone_history uzh
       INNER JOIN points_of_interest poi ON uzh.poi_id = poi.id
       INNER JOIN zones z ON poi.zone_id = z.id
       WHERE poi.subnet_id = ? 
         AND uzh.user_id = ?
         AND uzh.action_type IN ('UnlockedPOI', 'Breached', 'RemoteBreach')
       ORDER BY uzh.timestamp DESC
       LIMIT 50`,
      [subnetId, userId]
    );

    // Get all users' activity in this subnet for "all activity" view
    const [allHistoryRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.user_id,
        uzh.action_type,
        uzh.timestamp,
        u.username,
        u.mirror_name,
        poi.name as poi_name,
        z.name as zone_name
       FROM user_zone_history uzh
       INNER JOIN users u ON uzh.user_id = u.id
       INNER JOIN points_of_interest poi ON uzh.poi_id = poi.id
       INNER JOIN zones z ON poi.zone_id = z.id
       WHERE poi.subnet_id = ?
         AND uzh.action_type IN ('UnlockedPOI', 'Breached', 'RemoteBreach')
       ORDER BY uzh.timestamp DESC
       LIMIT 100`,
      [subnetId]
    );

    // Check Mirror equipped status for each unique user and format history
    const userMirrorStatus = new Map<number, boolean>();
    
    const allHistory = await Promise.all(allHistoryRows.map(async (row: any) => {
      // Check if we've already looked up this user's Mirror status
      let mirrorEquipped = userMirrorStatus.get(row.user_id);
      if (mirrorEquipped === undefined) {
        mirrorEquipped = await isMirrorEquipped(pool, row.user_id);
        userMirrorStatus.set(row.user_id, mirrorEquipped);
      }

      // Determine display name based on Mirror equipped status
      let alias = row.username || 'Unknown';
      if (mirrorEquipped && row.mirror_name) {
        alias = row.mirror_name;
      }

      let message = '';
      
      if (row.action_type === 'UnlockedPOI') {
        message = `[${alias}] discovered ${row.poi_name} in ${row.zone_name}`;
      } else if (row.action_type === 'Breached') {
        message = `[${alias}] breached ${row.poi_name} in ${row.zone_name}`;
      } else if (row.action_type === 'RemoteBreach') {
        message = `[${alias}] remotely breached ${row.poi_name} in ${row.zone_name}`;
      } else if (row.action_type === 'Traveled') {
        message = `[${alias}] traveled to ${row.zone_name}`;
      } else {
        message = `[${alias}] ${row.action_type.toLowerCase()} ${row.poi_name}`;
      }
      
      return {
        id: row.id,
        message,
        timestamp: row.timestamp,
        action_type: row.action_type
      };
    }));

    logger.info('Retrieved subnet details', { fid, subnetId });
    
    return NextResponse.json({
      subnet,
      protocols: protocolRows,
      terminals: poiRows,
      history: historyRows,
      allHistory,
      access: accessData
    });
  } catch (err: any) {
    console.error('Subnet API error:', err);
    logger.error('Subnet API error', { error: err.message, stack: err.stack });
    return handleApiError(err, '/api/subnets/[subnet]');
  }
}
