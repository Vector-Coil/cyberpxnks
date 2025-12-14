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

    // Fetch districts where user has discovered zones
    logger.debug('Fetching districts', { fid, userId });
    const [districts] = await pool.execute<any[]>(
      `SELECT DISTINCT zd.id, zd.name, zd.description, zd.phase
       FROM zone_districts zd
       INNER JOIN zones z ON z.district = zd.id
       INNER JOIN user_zone_history uzh ON uzh.zone_id = z.id
       WHERE uzh.user_id = ? AND uzh.action_type = 'Discovered'
       ORDER BY zd.phase ASC`,
      [userId]
    );

    logger.info('Retrieved districts', { fid, count: districts.length });
    return NextResponse.json(districts);
  } catch (error: any) {
    return handleApiError(error, '/api/districts');
  }
}
