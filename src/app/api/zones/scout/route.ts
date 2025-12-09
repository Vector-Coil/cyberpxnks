import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    const { zoneId, staminaCost } = body;

    if (!zoneId || !staminaCost) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current stats
    const [statsRows] = await pool.execute<any[]>(
      'SELECT * FROM user_stats WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    const stats = (statsRows as any[])[0];

    if (!stats) {
      return NextResponse.json({ error: 'Stats not found' }, { status: 404 });
    }

    // Count currently active jobs
    const [activeJobsRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring')
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [user.id]
    );
    const activeCount = (activeJobsRows as any[])[0]?.active_count || 0;

    if (activeCount >= stats.max_bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max_bandwidth})` }, { status: 400 });
    }

    // Check for existing active scout in this zone (only if end_time is in the future)
    const [existingScout] = await pool.execute<any[]>(
      `SELECT id FROM user_zone_history 
       WHERE user_id = ? 
       AND zone_id = ? 
       AND action_type = 'Scouted' 
       AND end_time IS NOT NULL 
       AND end_time > UTC_TIMESTAMP()
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [user.id, zoneId]
    );

    if (existingScout.length > 0) {
      return NextResponse.json({ error: 'Scout already in progress for this zone' }, { status: 400 });
    }

    // Validate requirements
    if (stats.current_consciousness < (stats.max_consciousness * 0.5)) {
      return NextResponse.json({ error: 'Insufficient consciousness' }, { status: 400 });
    }
    if (stats.current_bandwidth < 1) {
      return NextResponse.json({ error: 'Insufficient bandwidth' }, { status: 400 });
    }
    if (stats.current_stamina < staminaCost) {
      return NextResponse.json({ error: 'Insufficient stamina' }, { status: 400 });
    }

    // Deduct costs
    await pool.execute(
      `UPDATE user_stats 
       SET current_stamina = current_stamina - ?,
           current_bandwidth = current_bandwidth - 1
       WHERE user_id = ?`,
      [staminaCost, user.id]
    );

    // Create scout action in history
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + 60 * 60 * 1000); // 1 hour from now

    const [insertResult] = await pool.execute<any>(
      `INSERT INTO user_zone_history 
       (user_id, zone_id, action_type, timestamp, end_time)
       VALUES (?, ?, 'Scouted', ?, ?)`,
      [user.id, zoneId, timestamp, endTime]
    );

    // Log scout start activity
    await logActivity(
      user.id,
      'action',
      'scout_started',
      60, // 1 minute in seconds (testing)
      zoneId,
      `Started scouting zone ${zoneId}`
    );

    // Fetch updated stats
    const [updatedStatsRows] = await pool.execute<any[]>(
      'SELECT * FROM user_stats WHERE user_id = ? LIMIT 1',
      [user.id]
    );

    // Fetch the created scout action
    const [scoutRows] = await pool.execute<any[]>(
      'SELECT * FROM user_zone_history WHERE id = ? LIMIT 1',
      [(insertResult as any).insertId]
    );

    return NextResponse.json({
      success: true,
      scoutAction: scoutRows[0],
      updatedStats: updatedStatsRows[0]
    });
  } catch (err: any) {
    console.error('Scout API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to start scout action' },
      { status: 500 }
    );
  }
}
