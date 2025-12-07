import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;
    const historyIdParam = searchParams.get('historyId');
    const historyId = historyIdParam ? parseInt(historyIdParam, 10) : null;

    if (Number.isNaN(fid) || !historyId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get breach details including POI ID
    const [breachRows] = await pool.execute<any[]>(
      `SELECT id, zone_id, poi_id, action_type, timestamp, end_time, result_status
       FROM user_zone_history
       WHERE id = ? AND user_id = ? LIMIT 1`,
      [historyId, user.id]
    );

    if (breachRows.length === 0) {
      return NextResponse.json({ error: 'Breach not found' }, { status: 404 });
    }

    const breach = breachRows[0];
    
    return NextResponse.json({
      id: breach.id,
      zone_id: breach.zone_id,
      poi_id: breach.poi_id,
      action_type: breach.action_type,
      timestamp: breach.timestamp,
      end_time: breach.end_time,
      result_status: breach.result_status
    });
  } catch (err: any) {
    console.error('Breach detail API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to get breach details' },
      { status: 500 }
    );
  }
}
