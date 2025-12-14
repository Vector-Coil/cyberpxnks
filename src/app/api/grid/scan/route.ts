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

    logger.apiRequest('POST', '/api/grid/scan', { fid });

    const dbPool = await getDbPool();
    
    const body = await request.json();
    requireParams(body, ['chargeCost']);
    const { chargeCost } = body;

    // Get user ID
    const userId = await getUserIdByFid(dbPool, fid);

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
    const stats = await statsService.getStats();

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

    if (activeCount >= stats.max.bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max.bandwidth})` }, { status: 400 });
    }

    // Validate resources
    validateResources(stats.current, ACTION_COSTS.GRID_SCAN, stats.max);

    // Deduct costs using StatsService
    await statsService.modifyStats({
      charge: -chargeCost,
      bandwidth: -1
    });

    // Create scan action
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + COOLDOWNS.GRID_SCAN);

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
      Math.floor(COOLDOWNS.GRID_SCAN / 1000),
      null,
      'Started Overnet Scan'
    );

    logger.info('Grid scan started', { userId, scanId: insertResult.insertId });

    // Get updated stats using StatsService (reuse existing instance)
    const updatedFullStats = await statsService.getStats();

    return NextResponse.json({
      success: true,
      scanAction: {
        id: insertResult.insertId,
        timestamp,
        end_time: endTime,
        result_status: null
      },
      updatedStats: {
        current_charge: updatedFullStats.current.charge,
        max_charge: updatedFullStats.max.charge,
        current_bandwidth: updatedFullStats.current.bandwidth,
        max_bandwidth: updatedFullStats.max.bandwidth,
        current_neural: updatedFullStats.current.neural,
        max_neural: updatedFullStats.max.neural,
        current_thermal: updatedFullStats.current.thermal,
        max_thermal: updatedFullStats.max.thermal
      }
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/grid/scan');
  }
}
