import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  try {
    const dbPool = await getDbPool();
    const userId = await getUserIdByFid(dbPool, fid);

    // Check for active explore action (zone_id = NULL, action_type = 'Exploring')
    // Return if:
    // 1. In progress: end_time > now AND result_status is NULL/empty
    // 2. Ready for results: end_time <= now AND result_status is NULL/empty (TIME EXPIRED, NOT YET VIEWED)
    // 3. NOT if already viewed (result_status = 'completed') - those should be dismissed first
    const [historyRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, timestamp, end_time, result_status 
       FROM user_zone_history 
       WHERE user_id = ? 
         AND zone_id IS NULL 
         AND action_type = 'Exploring'
         AND end_time IS NOT NULL
         AND result_status != 'dismissed'
         AND (result_status IS NULL OR result_status = '')
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [userId]
    );

    if (historyRows.length > 0) {
      logger.debug('Active explore found', { fid, historyId: historyRows[0].id });
      return NextResponse.json({
        activeExplore: {
          id: historyRows[0].id,
          timestamp: historyRows[0].timestamp,
          end_time: historyRows[0].end_time,
          result_status: historyRows[0].result_status
        }
      });
    }

    return NextResponse.json({ activeExplore: null });
  } catch (error) {
    return handleApiError(error, '/api/city/explore-status');
  }
}
