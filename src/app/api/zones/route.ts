import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Fetch discovered zones for this user with POI counts
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT z.id, z.name, z.zone_type, z.description, z.image_url, 
              zt.name as zone_type_name, zd.name as district_name,
              COUNT(DISTINCT CASE WHEN poi.poi_type = 'shop' THEN poi.id END) as shop_count,
              COUNT(DISTINCT CASE WHEN poi.poi_type != 'shop' THEN poi.id END) as terminal_count
       FROM zones z
       INNER JOIN user_zone_history uzh ON z.id = uzh.zone_id AND uzh.action_type = 'Discovered'
       LEFT JOIN zone_type zt ON z.zone_type = zt.id
       LEFT JOIN zone_districts zd ON z.district = zd.id
       LEFT JOIN user_zone_history uzh_poi ON z.id = uzh_poi.zone_id AND uzh_poi.user_id = uzh.user_id AND uzh_poi.poi_id IS NOT NULL
       LEFT JOIN points_of_interest poi ON uzh_poi.poi_id = poi.id
       WHERE uzh.user_id = ?
       GROUP BY z.id, z.name, z.zone_type, z.description, z.image_url, zt.name, zd.name
       ORDER BY z.name`,
      [userId]
    );

    logger.info('Retrieved zones', { fid, count: zoneRows.length });
    return NextResponse.json(zoneRows);
  } catch (err: any) {
    return handleApiError(err, '/api/zones');
  }
}
