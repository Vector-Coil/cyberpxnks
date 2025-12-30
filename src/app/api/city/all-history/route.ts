import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';
import { isMirrorEquipped } from '../../../../lib/mirrorUtils';

export async function GET(request: NextRequest) {
  try {
    const pool = await getDbPool();

    // Fetch all users' history across all city zones with their usernames, mirror_names, and zone info
    const [historyRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.user_id,
        uzh.zone_id,
        uzh.action_type,
        uzh.timestamp,
        uzh.poi_id,
        uzh.discovered,
        u.username,
        u.mirror_name,
        u.rednet_id,
        u.subversive_id,
        poi.name as poi_name,
        poi.subnet_id,
        z.name as zone_name,
        z.id as zone_id,
        zd.name as district_name,
        discovered_zone.name as discovered_zone_name
      FROM user_zone_history uzh
      JOIN users u ON uzh.user_id = u.id
      JOIN zones z ON uzh.zone_id = z.id
      LEFT JOIN zone_districts zd ON z.district = zd.id
      LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
      LEFT JOIN zones discovered_zone ON uzh.discovered = discovered_zone.id
      WHERE uzh.result_status IN ('completed', 'success', 'Complete')
      AND z.zone_type = 1
      ORDER BY uzh.timestamp DESC
      LIMIT 100`,
      []
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

      // Build location suffix
      const locationSuffix = row.district_name 
        ? ` at ${row.zone_name} in ${row.district_name} district`
        : ` at ${row.zone_name}`;

      switch (row.action_type) {
        case 'Breached':
          // Use display name for breaches
          const poiName = row.poi_name || 'terminal';
          message = `[${alias}] breached ${poiName}${locationSuffix}`;
          break;

        case 'Discovered':
          // Use display name for discoveries
          const discoveredZone = row.discovered_zone_name || 'an unknown zone';
          message = `[${alias}] discovered ${discoveredZone}`;
          break;

        case 'UnlockedPOI':
          // POI discovery
          const unlockedPoiName = row.poi_name || 'a terminal';
          message = `[${alias}] discovered ${unlockedPoiName}${locationSuffix}`;
          break;

        case 'Traveled':
          // Travel action
          message = `[${alias}] traveled${locationSuffix}`;
          break;

        case 'Scouted':
          // Use display name for scouts
          message = `[${alias}] scouted${locationSuffix}`;
          break;

        case 'Explored':
          // Use display name for explores
          message = `[${alias}] explored the city`;
          break;

        case 'Recon':
          // Use rednet_id for Recon actions (RedNet faction)
          alias = row.rednet_id || 'RedNet Agent';
          message = `[${alias}] performed reconnaissance${locationSuffix}`;
          break;

        case 'Fortify':
          // Use subversive_id for Fortify actions (Subversive faction)
          alias = row.subversive_id || 'Subversive';
          message = `[${alias}] fortified their position${locationSuffix}`;
          break;

        default:
          message = `[${alias}] performed ${row.action_type.toLowerCase()}${locationSuffix}`;
      }

      return {
        id: row.id,
        message,
        timestamp: row.timestamp,
        zone_id: row.zone_id,
        zone_name: row.zone_name,
        district_name: row.district_name
      };
    }));

    return NextResponse.json({ history: formattedHistory });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch city history');
  }
}
