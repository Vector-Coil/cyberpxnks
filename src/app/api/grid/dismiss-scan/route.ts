import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    
    const body = await request.json();
    const { historyId } = body;

    // Get user ID
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Mark scan as dismissed
    await dbPool.query(
      `UPDATE user_zone_history 
       SET result_status = 'dismissed' 
       WHERE id = ? AND user_id = ?`,
      [historyId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error dismissing scan:', error);
    return NextResponse.json({ error: 'Failed to dismiss scan' }, { status: 500 });
  }
}
