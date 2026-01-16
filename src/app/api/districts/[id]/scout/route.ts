import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../../lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { StatsService } from '../../../../../lib/statsService';
import { getUserIdByFid } from '../../../../../lib/api/userUtils';
import { validateFid, handleApiError, requireParams } from '../../../../../lib/api/errors';
import { validateResources } from '../../../../../lib/game/resourceValidator';
import { ACTION_COSTS, COOLDOWNS } from '../../../../../lib/game/constants';
import { logger } from '../../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const districtsIndex = pathParts.indexOf('districts');
    const districtId = parseInt(pathParts[districtsIndex + 1], 10);

    const fid = validateFid(url.searchParams.get('fid'));

    logger.apiRequest('POST', `/api/districts/${districtId}/scout`, { fid, districtId });

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
      return NextResponse.json({ error: 'You already have an active explore action' }, { status: 400 });
    }

    // Check for active physical presence actions (Scout or Physical Breach)
    const [physicalPresenceRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT uzh.id, uzh.action_type, uzh.end_time, u.location, uzh.zone_id
       FROM user_zone_history uzh
       JOIN users u ON uzh.user_id = u.id
       WHERE uzh.user_id = ?
         AND (
           (uzh.action_type = 'Scouted' AND uzh.end_time > UTC_TIMESTAMP())
           OR (uzh.action_type = 'Breached' AND u.location = uzh.zone_id AND uzh.end_time > UTC_TIMESTAMP())
         )
         AND (uzh.result_status IS NULL OR uzh.result_status = '')
       LIMIT 1`,
      [userId]
    );

    if (physicalPresenceRows.length > 0) {
      const conflictingAction = physicalPresenceRows[0];
      const actionName = conflictingAction.action_type === 'Scouted' ? 'Scout' : 'Physical Breach';
      return NextResponse.json({
        error: `Cannot scout while ${actionName} is in progress. Only one physical action can be active at a time.`
      }, { status: 400 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(dbPool, userId);
    const stats = await statsService.getStats();

    // Count currently active jobs
    const [activeJobsRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring', 'RemoteBreach', 'OvernetScan')
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

    // Deduct costs
    await statsService.modifyStats({ stamina: -staminaCost, bandwidth: -1 });

    // Create district scout action (uses Exploring action_type, history row will be used by results endpoint)
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + COOLDOWNS.CITY_EXPLORE);

    const [insertResult] = await dbPool.query<ResultSetHeader>(
      `INSERT INTO user_zone_history 
       (user_id, zone_id, district_id, action_type, timestamp, end_time) 
       VALUES (?, NULL, ?, 'Exploring', ?, ?)`,
      [userId, districtId, timestamp, endTime]
    );

    await logActivity(userId, 'action', 'district_explore_started', Math.floor(COOLDOWNS.CITY_EXPLORE / 1000), null, `Started scouting district ${districtId}`);

    const updatedStats = await statsService.getStats();

    return NextResponse.json({
      success: true,
      scoutAction: {
        id: insertResult.insertId,
        timestamp,
        end_time: endTime
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
    return handleApiError(error, 'POST /api/districts/[id]/scout');
  }
}
