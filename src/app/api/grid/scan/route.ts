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
    const { chargeCost } = body;

    // Get user ID
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Check for existing active scan (only if end_time is in the future)
    const [existingScanRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT id FROM user_zone_history 
       WHERE user_id = ? 
         AND zone_id IS NULL 
         AND action_type = 'OvernetScan'
         AND end_time IS NOT NULL 
         AND end_time > UTC_TIMESTAMP()
         AND (result_status IS NULL OR result_status = '')`,
      [userId]
    );

    if (existingScanRows.length > 0) {
      return NextResponse.json({ error: 'You already have an active Overnet Scan' }, { status: 400 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(dbPool, userId);
    const fullStats = await statsService.getStats();
    const stats = {
      current_charge: fullStats.current.charge,
      current_bandwidth: fullStats.current.bandwidth,
      max_bandwidth: fullStats.max.bandwidth,
      current_neural: fullStats.current.neural,
      max_neural: fullStats.max.neural,
      current_thermal: fullStats.current.thermal,
      max_thermal: fullStats.max.thermal
    };

    // Count currently active jobs
    const [activeJobsRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring', 'OvernetScan', 'RemoteBreach')
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [userId]
    );
    const activeCount = activeJobsRows[0]?.active_count || 0;

    if (activeCount >= stats.max_bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max_bandwidth})` }, { status: 400 });
    }

    // Validate requirements
    if (stats.current_charge < chargeCost) {
      return NextResponse.json({ error: `Not enough charge (need ${chargeCost})` }, { status: 400 });
    }
    if (stats.current_bandwidth < 1) {
      return NextResponse.json({ error: 'Not enough bandwidth (need 1)' }, { status: 400 });
    }

    // Deduct costs
    await dbPool.query(
      `UPDATE user_stats 
       SET current_charge = current_charge - ?, 
           current_bandwidth = current_bandwidth - 1 
       WHERE user_id = ?`,
      [chargeCost, userId]
    );

    // Create scan action (1 minute duration for testing)
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + 1 * 60 * 1000);

    const [insertResult] = await dbPool.query<ResultSetHeader>(
      `INSERT INTO user_zone_history 
       (user_id, zone_id, action_type, timestamp, end_time) 
       VALUES (?, NULL, 'OvernetScan', ?, ?)`,
      [userId, timestamp, endTime]
    );

    // Log scan start activity
    await logActivity(
      userId,
      'action',
      'overnet_scan_started',
      60, // 1 minute in seconds (testing)
      null,
      'Started Overnet Scan'
    );

    // Get updated stats
    const [updatedStatsRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT current_charge, current_bandwidth, current_neural, current_thermal
       FROM user_stats 
       WHERE user_id = ?`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      scanAction: {
        id: insertResult.insertId,
        timestamp,
        end_time: endTime,
        result_status: null
      },
      updatedStats: updatedStatsRows[0]
    });
  } catch (error) {
    console.error('Error starting Overnet Scan:', error);
    return NextResponse.json({ error: 'Failed to start Overnet Scan' }, { status: 500 });
  }
}
