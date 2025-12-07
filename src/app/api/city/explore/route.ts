import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    
    const body = await request.json();
    const { staminaCost } = body;

    // Get user ID
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Check for existing active explore (only if end_time is in the future)
    const [existingExploreRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id, end_time, result_status, UTC_TIMESTAMP() as now
       FROM user_zone_history 
       WHERE user_id = ? 
         AND zone_id IS NULL 
         AND action_type = 'Exploring'
         AND end_time IS NOT NULL 
         AND end_time > UTC_TIMESTAMP()
         AND (result_status IS NULL OR result_status = '')`,
      [userId]
    );

    if (existingExploreRows.length > 0) {
      console.log('[EXPLORE] Blocked by active explore:', existingExploreRows[0]);
      return NextResponse.json({ 
        error: 'You already have an active explore action',
        debug: existingExploreRows[0]
      }, { status: 400 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(dbPool, userId);
    const fullStats = await statsService.getStats();
    const stats = {
      current_consciousness: fullStats.current.consciousness,
      max_consciousness: fullStats.max.consciousness,
      current_stamina: fullStats.current.stamina,
      current_bandwidth: fullStats.current.bandwidth,
      max_bandwidth: fullStats.max.bandwidth
    };
    const minConsciousness = stats.max_consciousness * 0.5;

    // Count currently active jobs
    const [activeJobsRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring')
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [userId]
    );
    const activeCount = activeJobsRows[0]?.active_count || 0;

    if (activeCount >= stats.max_bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max_bandwidth})` }, { status: 400 });
    }

    // Validate requirements
    if (stats.current_consciousness < minConsciousness) {
      return NextResponse.json({ error: 'Not enough consciousness (need 50%)' }, { status: 400 });
    }
    if (stats.current_stamina < staminaCost) {
      return NextResponse.json({ error: `Not enough stamina (need ${staminaCost})` }, { status: 400 });
    }
    if (stats.current_bandwidth < 1) {
      return NextResponse.json({ error: 'Not enough bandwidth (need 1)' }, { status: 400 });
    }

    // Deduct costs
    await dbPool.query(
      `UPDATE user_stats 
       SET current_stamina = current_stamina - ?, 
           current_bandwidth = current_bandwidth - 1 
       WHERE user_id = ?`,
      [staminaCost, userId]
    );

    // Create explore action (3 minutes duration for testing)
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + 3 * 60 * 1000);

    const [insertResult] = await dbPool.query<ResultSetHeader>(
      `INSERT INTO user_zone_history 
       (user_id, zone_id, action_type, timestamp, end_time) 
       VALUES (?, NULL, 'Exploring', ?, ?)`,
      [userId, timestamp, endTime]
    );

    // Log explore start activity
    await logActivity(
      userId,
      'action',
      'explore_started',
      180, // 3 minutes in seconds (testing)
      null,
      'Started exploring the city'
    );

    // Get updated stats using StatsService
    const updatedStats = await statsService.getStats();

    return NextResponse.json({
      success: true,
      exploreAction: {
        id: insertResult.insertId,
        timestamp,
        end_time: endTime,
        result_status: null
      },
      updatedStats: {
        current_consciousness: updatedStats.current.consciousness,
        max_consciousness: updatedStats.max.consciousness,
        current_stamina: updatedStats.current.stamina,
        current_bandwidth: updatedStats.current.bandwidth
      }
    });
  } catch (error) {
    console.error('Error starting explore:', error);
    return NextResponse.json({ error: 'Failed to start explore' }, { status: 500 });
  }
}
