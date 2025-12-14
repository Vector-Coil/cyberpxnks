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

    // Check for active OR ready (but not already completed) scan
    // Return if:
    // 1. In progress or ready for results: result_status is NULL/empty (regardless of end_time)
    // 2. NOT if already viewed (result_status = 'completed') - those should be dismissed first
    const [scanRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, timestamp, end_time, result_status 
       FROM user_zone_history 
       WHERE user_id = ? 
         AND zone_id IS NULL 
         AND action_type = 'OvernetScan'
         AND end_time IS NOT NULL 
         AND result_status != 'dismissed'
         AND (result_status IS NULL OR result_status = '')
       ORDER BY timestamp DESC
       LIMIT 1`,
      [userId]
    );

    if (scanRows.length === 0) {
      return NextResponse.json({ activeScan: null });
    }

    logger.debug('Active scan found', { fid, scanId: scanRows[0].id });
    return NextResponse.json({ 
      activeScan: scanRows[0]
    });
  } catch (error) {
    return handleApiError(error, '/api/grid/scan-status');
  }
}
