import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { validateFid, handleApiError, requireParams } from '../../../../lib/api/errors';
import { validateResources } from '../../../../lib/game/resourceValidator';
import { ACTION_COSTS, COOLDOWNS } from '../../../../lib/game/constants';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = validateFid(searchParams.get('fid'));

    logger.apiRequest('POST', '/api/city/explore', { fid });

    const dbPool = await getDbPool();
    
    const body = await request.json();
    requireParams(body, ['staminaCost']);
    const { staminaCost } = body;

    // Get user ID
    const userId = await getUserIdByFid(dbPool, fid);

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
      logger.warn('Blocked by active explore', { userId, existing: existingExploreRows[0] });
      return NextResponse.json({ 
        error: 'You already have an active explore action'
      }, { status: 400 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(dbPool, userId);
    const stats = await statsService.getStats();

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

    if (activeCount >= stats.max.bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max.bandwidth})` }, { status: 400 });
    }

    // Validate resources
    validateResources(stats.current, {
      stamina: staminaCost,
      bandwidth: 1,
      minConsciousnessPercent: 0.5
    }, stats.max);

    // Deduct costs using StatsService
    await statsService.modifyStats({
      stamina: -staminaCost,
      bandwidth: -1
    });

    // Create explore action
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + COOLDOWNS.CITY_EXPLORE);

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
      Math.floor(COOLDOWNS.CITY_EXPLORE / 1000),
      null,
      'Started exploring the city'
    );

    logger.info('City explore started', { userId, exploreId: insertResult.insertId });

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
        max_stamina: updatedStats.max.stamina,
        current_bandwidth: updatedStats.current.bandwidth,
        max_bandwidth: updatedStats.max.bandwidth
      }
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/city/explore');
  }
}
