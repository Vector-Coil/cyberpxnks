import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { validateFid, handleApiError } from '../../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../../lib/api/userUtils';
import { logger } from '../../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, historyId } = body;

    if (!fid || !historyId) {
      return NextResponse.json({ error: 'Missing fid or historyId' }, { status: 400 });
    }

    const validFid = validateFid(fid);
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, validFid);

    // Update the district explore action to mark as dismissed
    const [result] = await pool.execute<any>(
      `UPDATE user_zone_history 
       SET result_status = 'dismissed' 
       WHERE id = ? AND user_id = ? AND action_type = 'Exploring' AND result_status = 'completed'`,
      [historyId, userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Explore action not found or already dismissed' }, { status: 404 });
    }

    logger.info('District explore dismissed', { fid: validFid, historyId, userId });

    return NextResponse.json({ 
      success: true,
      message: 'Explore action dismissed successfully'
    });

  } catch (error) {
    return handleApiError(error, 'district-dismiss-explore');
  }
}
