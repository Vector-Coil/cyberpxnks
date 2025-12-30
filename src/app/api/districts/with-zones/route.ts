import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '~/lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const fid = validateFid(req.nextUrl.searchParams.get('fid'));
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Fetch districts where user has discovered zones, include level
    logger.debug('Fetching districts with zones', { fid, userId });
    
    const [districts] = await pool.execute<any[]>(
      `SELECT DISTINCT zd.id, zd.name, zd.description, zd.phase, zd.level, zd.image_url
       FROM zone_districts zd
       INNER JOIN zones z ON z.district = zd.id
       INNER JOIN user_zone_history uzh ON uzh.zone_id = z.id
       WHERE uzh.user_id = ? AND uzh.action_type = 'Discovered'
       ORDER BY zd.level ASC, zd.name ASC`,
      [userId]
    );

    // For each district, fetch its discovered zones
    const districtsWithZones = await Promise.all(
      (districts as any[]).map(async (district) => {
        const [zones] = await pool.execute<any[]>(
          `SELECT z.id, z.name, z.zone_type, z.description, 
                  zt.image_url, zt.name as zone_type_name, 
                  zd.name as district_name, zd.id as district_id,
                  COUNT(DISTINCT CASE WHEN poi.poi_type = 'shop' THEN poi.id END) as shop_count,
                  COUNT(DISTINCT CASE WHEN poi.poi_type != 'shop' THEN poi.id END) as terminal_count,
                  MIN(uzh.timestamp) as discovery_time
           FROM zones z
           INNER JOIN user_zone_history uzh ON z.id = uzh.zone_id AND uzh.action_type = 'Discovered'
           LEFT JOIN zone_type zt ON z.zone_type = zt.id
           LEFT JOIN zone_districts zd ON z.district = zd.id
           LEFT JOIN user_zone_history uzh_poi ON z.id = uzh_poi.zone_id AND uzh_poi.user_id = uzh.user_id AND uzh_poi.poi_id IS NOT NULL
           LEFT JOIN points_of_interest poi ON uzh_poi.poi_id = poi.id
           WHERE uzh.user_id = ? AND z.district = ?
           GROUP BY z.id, z.name, z.zone_type, z.description, zt.image_url, zt.name, zd.name, zd.id
           ORDER BY z.name`,
          [userId, district.id]
        );

        return {
          ...district,
          zones: zones
        };
      })
    );

    logger.info('Retrieved districts with zones', { fid, count: districtsWithZones.length });
    return NextResponse.json(districtsWithZones);
  } catch (error: any) {
    return handleApiError(error, '/api/districts/with-zones');
  }
}
