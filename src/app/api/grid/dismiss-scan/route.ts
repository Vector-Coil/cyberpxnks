import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid, requireParams, handleApiError } from '../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  try {
    const dbPool = await getDbPool();
    
    const body = await request.json();
    requireParams(body, ['historyId']);
    const { historyId } = body;

    const userId = await getUserIdByFid(dbPool, fid);

    // Mark scan as dismissed (only if it's already been viewed/completed)
    const [result] = await dbPool.execute<any>(
      `UPDATE user_zone_history 
       SET result_status = 'dismissed' 
       WHERE id = ? AND user_id = ? AND action_type = 'OvernetScan' AND result_status = 'completed'`,
      [historyId, userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Scan not found or already dismissed' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to dismiss scan');
  }
}
