import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
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

    // Fetch all active jobs (in progress or ready to complete)
    const [jobRows] = await pool.execute<any[]>(
      `SELECT 
        uzh.id,
        uzh.zone_id,
        uzh.action_type,
        uzh.timestamp,
        uzh.end_time,
        uzh.poi_id,
        z.name as zone_name,
        poi.name as poi_name,
        CASE 
          WHEN uzh.action_type = 'OvernetScan' THEN 'Cyberspace'
          WHEN uzh.action_type = 'Exploring' THEN 'City'
          ELSE z.name
        END as location
      FROM user_zone_history uzh
      LEFT JOIN zones z ON uzh.zone_id = z.id
      LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
      WHERE uzh.user_id = ? 
      AND uzh.action_type IN ('Breached', 'Scouted', 'Exploring', 'OvernetScan', 'RemoteBreach')
      AND (uzh.result_status IS NULL OR uzh.result_status = '')
      ORDER BY uzh.end_time ASC`,
      [user.id]
    );

    return NextResponse.json({ 
      jobs: jobRows 
    });
  } catch (err: any) {
    console.error('Active jobs API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch active jobs' },
      { status: 500 }
    );
  }
}
