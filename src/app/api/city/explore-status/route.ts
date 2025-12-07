import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Check for active explore action (zone_id = NULL, action_type = 'Exploring')
    // Only return if end_time is in the future (still in progress)
    const [historyRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, timestamp, end_time, result_status 
       FROM user_zone_history 
       WHERE user_id = ? 
         AND zone_id IS NULL 
         AND action_type = 'Exploring'
         AND end_time IS NOT NULL 
         AND end_time > UTC_TIMESTAMP()
         AND (result_status IS NULL OR result_status = '')
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [userId]
    );

    if (historyRows.length > 0) {
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
    console.error('Error checking explore status:', error);
    return NextResponse.json({ error: 'Failed to check explore status' }, { status: 500 });
  }
}
