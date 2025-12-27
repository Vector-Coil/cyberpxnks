import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

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

    // Verify user has access to this subnet
    const [accessRows] = await pool.execute<any[]>(
      `SELECT usa.unlocked_at, usa.unlock_method
       FROM user_subnet_access usa
       WHERE usa.user_id = ? AND usa.subnet_id = ?`,
      [userId, subnetId]
    );

    if (accessRows.length === 0) {
      return NextResponse.json({ error: 'Subnet not unlocked' }, { status: 403 });
    }

    // Get subnet details
    const [subnetRows] = await pool.execute<any[]>(
      `SELECT 
        s.id,
        s.name,
        s.description,
        s.image_url
       FROM subnets s
       WHERE s.id = ?
       LIMIT 1`,
      [subnetId]
    );

    if (subnetRows.length === 0) {
      return NextResponse.json({ error: 'Subnet not found' }, { status: 404 });
    }

    const subnet = subnetRows[0];

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
        uzh.action_type,
        uzh.timestamp,
        u.username,
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

    // Format all history messages
    const allHistory = allHistoryRows.map((row: any) => {
      const alias = row.username;
      let message = '';
      
      if (row.action_type === 'UnlockedPOI') {
        message = `[${alias}] discovered ${row.poi_name} in ${row.zone_name}`;
      } else if (row.action_type === 'Breached') {
        message = `[${alias}] breached ${row.poi_name} in ${row.zone_name}`;
      } else if (row.action_type === 'RemoteBreach') {
        message = `[${alias}] remotely breached ${row.poi_name} in ${row.zone_name}`;
      } else {
        message = `[${alias}] performed ${row.action_type} on ${row.poi_name}`;
      }
      
      return {
        id: row.id,
        message,
        timestamp: row.timestamp,
        action_type: row.action_type
      };
    });

    logger.info('Retrieved subnet details', { fid, subnetId });
    
    return NextResponse.json({
      subnet,
      terminals: poiRows,
      history: historyRows,
      allHistory,
      access: accessRows[0]
    });
  } catch (err: any) {
    console.error('Subnet API error:', err);
    logger.error('Subnet API error', { error: err.message, stack: err.stack });
    return handleApiError(err, '/api/subnets/[subnet]');
  }
}
