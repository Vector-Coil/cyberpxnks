import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { handleApiError } from '../../../../../lib/api/errors';
import { logger } from '../../../../../lib/logger';
import { isMirrorEquipped } from '../../../../../lib/mirrorUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zone: string }> }
) {
  try {
    const { zone: zoneParam } = await params;
    const zoneId = parseInt(zoneParam, 10);
    if (Number.isNaN(zoneId)) {
      return NextResponse.json({ error: 'Invalid zone ID' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Fetch all users' history for this zone with their usernames, mirror_names, and subnet info
    const [historyRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.user_id,
        uzh.action_type,
        uzh.timestamp,
        uzh.poi_id,
        u.username,
        u.mirror_name,
        u.rednet_id,
        u.subversive_id,
        poi.name as poi_name,
        poi.subnet_id,
        z.name as discovered_zone_name
      FROM user_zone_history uzh
      JOIN users u ON uzh.user_id = u.id
      LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
      LEFT JOIN zones z ON uzh.gains_data LIKE CONCAT('%', z.name, '%') AND uzh.action_type = 'Discovered'
      WHERE uzh.zone_id = ?
      AND uzh.result_status IN ('completed', 'success', 'Complete')
      ORDER BY uzh.timestamp DESC
      LIMIT 50`,
      [zoneId]
    );

    // Check Mirror equipped status for each unique user and format history
    const userMirrorStatus = new Map<number, boolean>();
    
    const formattedHistory = await Promise.all(historyRows.map(async (row: any) => {
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

      switch (row.action_type) {
        case 'Breached':
          // Use display name for breaches
          const poiName = row.poi_name || 'terminal';
          message = `[${alias}] breached ${poiName}`;
          break;

        case 'Discovered':
          // Use display name for discoveries
          const discoveredZone = row.discovered_zone_name || 'an unknown zone';
          message = `[${alias}] discovered ${discoveredZone}`;
          break;

        case 'UnlockedPOI':
          // POI discovery
          const unlockedPoiName = row.poi_name || 'a terminal';
          message = `[${alias}] discovered ${unlockedPoiName}`;
          break;

        case 'Traveled':
          // Travel action
          message = `[${alias}] traveled here`;
          break;

        case 'Scouted':
          // Use display name for scouts
          message = `[${alias}] scouted the area`;
          break;

        case 'Explored':
          // Use display name for explores
          message = `[${alias}] explored the city`;
          break;

        case 'Recon':
          // Use rednet_id for Recon actions (RedNet faction)
          alias = row.rednet_id || 'RedNet Agent';
          message = `[${alias}] performed reconnaissance`;
          break;

        case 'Fortify':
          // Use subversive_id for Fortify actions (Subversive faction)
        case 'Fortify':
          // Use subversive_id for Fortify actions (Subversive faction)
          alias = row.subversive_id || 'Subversive';
          message = `[${alias}] fortified their position`;
          break;

        default:
          message = `[${alias}] performed ${row.action_type.toLowerCase()}`;
      }

      return {
        id: row.id,
        message,
        timestamp: row.timestamp
      };
    }));

    return NextResponse.json({ history: formattedHistory });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch all history');
  }
}
