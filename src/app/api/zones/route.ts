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

    // Fetch discovered zones for this user
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT DISTINCT z.id, z.name, z.zone_type, z.description, z.image_url, zt.name as zone_type_name, zd.name as district_name
       FROM zones z
       INNER JOIN user_zone_history uzh ON z.id = uzh.zone_id
       LEFT JOIN zone_type zt ON z.zone_type = zt.id
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE uzh.user_id = ?
       ORDER BY z.name`,
      [userId]
    );

    logger.info('Retrieved zones', { fid, count: zoneRows.length });
    return NextResponse.json(zoneRows);
  } catch (err: any) {
    return handleApiError(err, '/api/zones');
  }
}
