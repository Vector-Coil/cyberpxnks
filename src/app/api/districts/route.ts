import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '~/lib/db';

export async function GET(req: NextRequest) {
  try {
    const fid = req.nextUrl.searchParams.get('fid');
    if (!fid) {
      return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    const pool = await getDbPool();
    console.log('Got pool, fetching user for fid:', fid);

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];
    console.log('User found:', user);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch districts where user has discovered zones
    console.log('Fetching districts for user_id:', user.id);
    const [districts] = await pool.execute<any[]>(
      `SELECT DISTINCT zd.id, zd.name, zd.description, zd.phase
       FROM zone_districts zd
       INNER JOIN zones z ON z.district = zd.id
       INNER JOIN user_zone_history uzh ON uzh.zone_id = z.id
       WHERE uzh.user_id = ? AND uzh.action_type = 'Discovered'
       ORDER BY zd.phase ASC`,
      [user.id]
    );

    console.log('Districts found:', districts);
    return NextResponse.json(districts);
  } catch (error: any) {
    console.error('Error fetching districts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch districts', details: error.message },
      { status: 500 }
    );
  }
}
