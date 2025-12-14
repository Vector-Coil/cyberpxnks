import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid, requireParams, handleApiError } from '../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  validateFid(fid);

  try {
    const dbPool = await getDbPool();
    
    const body = await request.json();
    requireParams(body, ['historyId']);
    const { historyId } = body;

    const userId = await getUserIdByFid(dbPool, parseInt(fid!, 10));

    // Mark scan as dismissed
    await dbPool.query(
      `UPDATE user_zone_history 
       SET result_status = 'dismissed' 
       WHERE id = ? AND user_id = ?`,
      [historyId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to dismiss scan');
  }
}
