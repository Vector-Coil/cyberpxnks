import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';

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

    // Fetch all users' history for this zone with their secret names and subnet info
    const [historyRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.user_id,
        uzh.action_type,
        uzh.timestamp,
        uzh.poi_id,
        u.username,
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

    // Format each history entry into a public message
    const formattedHistory = historyRows.map((row: any) => {
      let alias = row.username || 'Unknown';
      let message = '';

      switch (row.action_type) {
        case 'Breached':
          // Use username for breaches
          const subnetName = row.subnet_id ? `subnet ${row.subnet_id}` : 'an';
          const poiName = row.poi_name || 'terminal';
          message = `[${alias}] breached the ${subnetName} access point ${poiName}`;
          break;

        case 'Discovered':
          // Use username for discoveries
          const discoveredZone = row.discovered_zone_name || 'a new zone';
          message = `[${alias}] discovered ${discoveredZone}`;
          break;

        case 'Scouted':
          // Use username for scouts
          message = `[${alias}] scouted the area`;
          break;

        case 'Explored':
          // Use username for explores
          message = `[${alias}] explored the city`;
          break;

        case 'Recon':
          // Use rednet_id for Recon actions (RedNet faction)
          alias = row.rednet_id || 'RedNet Agent';
          message = `[${alias}] performed reconnaissance`;
          break;

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
    });

    return NextResponse.json({ history: formattedHistory });
  } catch (err: any) {
    console.error('All history API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch all history' },
      { status: 500 }
    );
  }
}
