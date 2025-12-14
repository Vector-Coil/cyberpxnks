import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '~/lib/db';
import { validateFid, handleApiError } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const fid = req.nextUrl.searchParams.get('fid');
    validateFid(fid);

    const { id } = await params;
    const districtId = parseInt(id, 10);
    if (Number.isNaN(districtId)) {
      return NextResponse.json({ error: 'Invalid district ID' }, { status: 400 });
    }

    const pool = await getDbPool();
    logger.debug('Fetching district detail', { districtId, fid });

    const userId = await getUserIdByFid(pool, parseInt(fid!, 10));

    // Fetch district info
    const [districtRows]: any = await pool.execute(
      `SELECT id, name, description 
       FROM zone_districts 
       WHERE id = ?`,
      [districtId]
    );
    logger.debug('District query result', { districtId, found: districtRows.length > 0 });

    if (districtRows.length === 0) {
      return NextResponse.json({ error: 'District not found' }, { status: 404 });
    }

    const district = districtRows[0];

    // Fetch discovered zones in this district
    const [zones]: any = await pool.execute(
      `SELECT DISTINCT z.id, z.name, z.zone_type, zt.name as zone_type_name, z.description, z.image_url,
              zd.name as district_name
       FROM zones z
       INNER JOIN user_zone_history uzh ON z.id = uzh.zone_id
       LEFT JOIN zone_type zt ON z.zone_type = zt.id
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE uzh.user_id = ? AND uzh.action_type = 'Discovered' AND z.district = ?
       ORDER BY z.name ASC`,
      [userId, districtId]
    );

    // Fetch activity history for all zones in this district
    const [history]: any = await pool.execute(
        `SELECT 
           uzh.id,
           uzh.action_type,
           uzh.timestamp,
           uzh.end_time,
           uzh.result_status,
           z.name as zone_name,
           z.id as zone_id,
           u.username,
           poi.name as poi_name
         FROM user_zone_history uzh
         INNER JOIN zones z ON uzh.zone_id = z.id
         INNER JOIN users u ON uzh.user_id = u.id
         LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
         WHERE z.district = ? AND uzh.result_status = 'completed'
         ORDER BY uzh.timestamp DESC
         LIMIT 50`,
        [districtId]
      );

      // Format history messages
      const formattedHistory = history.map((entry: any) => {
        const displayName = entry.username || 'Unknown';

        let message = '';
        if (entry.action_type === 'Scout') {
          message = `${displayName} scouted ${entry.zone_name}`;
        } else if (entry.action_type === 'Breach') {
          message = `${displayName} breached ${entry.poi_name || 'a terminal'} in ${entry.zone_name}`;
        } else if (entry.action_type === 'Discovered') {
          message = `${displayName} discovered ${entry.zone_name}`;
        } else {
          message = `${displayName} completed ${entry.action_type} in ${entry.zone_name}`;
        }

        return {
          id: entry.id,
          message,
          timestamp: entry.timestamp,
          action_type: entry.action_type,
          zone_id: entry.zone_id,
          zone_name: entry.zone_name
        };
      });

      return NextResponse.json({
        district,
        zones,
        history: formattedHistory
      });
  } catch (error: any) {
    return handleApiError(error, 'Failed to fetch district details');
  }
}
