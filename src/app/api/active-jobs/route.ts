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

    // Fetch all active jobs (in progress or ready to complete)
    const [jobRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.zone_id,
        uzh.district_id,
        uzh.action_type,
        uzh.timestamp,
        uzh.end_time,
        uzh.poi_id,
        z.name as zone_name,
        poi.name as poi_name,
        zd.name as district_name,
        CASE 
          WHEN uzh.action_type = 'OvernetScan' THEN 'Cyberspace'
          WHEN uzh.action_type = 'Exploring' THEN COALESCE(zd.name, 'City')
          ELSE z.name
        END as location
      FROM user_zone_history uzh
      LEFT JOIN zones z ON uzh.zone_id = z.id
      LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
      LEFT JOIN zone_districts zd ON uzh.district_id = zd.id
      WHERE uzh.user_id = ? 
      AND uzh.action_type IN ('Breached', 'Scouted', 'Exploring', 'OvernetScan', 'RemoteBreach')
      AND (uzh.result_status IS NULL OR uzh.result_status = '')
      ORDER BY uzh.end_time ASC`,
      [userId]
    );

    logger.info('Retrieved active jobs', { fid, jobCount: jobRows.length });
    return NextResponse.json({ 
      jobs: jobRows 
    });
  } catch (err: any) {
    return handleApiError(err, '/api/active-jobs');
  }
}
