import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '~/lib/db';
import { StatsService } from '~/lib/statsService';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { validateFid, handleApiError, requireParams } from '~/lib/api/errors';
import { validateResources } from '~/lib/game/resourceValidator';
import { ACTION_COSTS } from '~/lib/game/constants';
import { logger } from '~/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    requireParams(body, ['fid', 'zoneId']);
    
    const fid = validateFid(body.fid);
    const { zoneId } = body;

    logger.apiRequest('POST', '/api/travel', { fid, zoneId });

    const pool = await getDbPool();

    // Get user ID
    const userId = await getUserIdByFid(pool, fid);

    // Check for active actions that would prevent travel
    const [activeActions]: any = await pool.execute(
      `SELECT id, action_type, end_time 
       FROM user_zone_history 
       WHERE user_id = ? 
         AND action_type IN ('Scouting', 'Breaching', 'RemoteBreach', 'OvernetScan', 'Exploring')
         AND result_status = 'in_progress' 
         AND end_time > UTC_TIMESTAMP()
       LIMIT 1`,
      [userId]
    );

    if (activeActions.length > 0) {
      const activeAction = activeActions[0];
      return NextResponse.json(
        { 
          error: `Cannot travel while ${activeAction.action_type.toLowerCase()} is in progress. Complete or wait for it to finish.`,
          activeAction: {
            type: activeAction.action_type,
            endsAt: activeAction.end_time
          }
        },
        { status: 400 }
      );
    }

    // Get user stats using StatsService
    const statsService = new StatsService(pool, userId);
    const stats = await statsService.getStats();

    // Validate resources
    validateResources(stats.current, ACTION_COSTS.ZONE_TRAVEL, stats.max);

    // Get zone name for history
    const [zoneRows]: any = await pool.execute(
      'SELECT name FROM zones WHERE id = ? LIMIT 1',
      [zoneId]
    );
    const zoneName = zoneRows[0]?.name || 'Unknown Zone';

    // Update user location
    await pool.execute(
      'UPDATE users SET location = ? WHERE id = ?',
      [zoneId, userId]
    );

    // Deduct travel costs using StatsService
    await statsService.modifyStats({
      stamina: -(ACTION_COSTS.ZONE_TRAVEL.stamina || 0),
      charge: -(ACTION_COSTS.ZONE_TRAVEL.charge || 0)
    });

    // Record travel in zone history
    await pool.execute(
      `INSERT INTO user_zone_history (user_id, zone_id, action_type, timestamp, result_status)
       VALUES (?, ?, 'Traveled', UTC_TIMESTAMP(), 'completed')`,
      [userId, zoneId]
    );

    // Log to activity ledger
    await logActivity(
      userId,
      'action',
      'travel',
      ACTION_COSTS.ZONE_TRAVEL.stamina || 0,
      zoneId,
      `Traveled to ${zoneName}`
    );

    logger.info('User traveled', { userId, zoneId, zoneName });

    // Get updated stats using StatsService
    const updatedStats = await statsService.getStats();

    return NextResponse.json({
      success: true,
      location: zoneId,
      updatedStats: {
        current_consciousness: updatedStats.current.consciousness,
        max_consciousness: updatedStats.max.consciousness,
        current_stamina: updatedStats.current.stamina,
        max_stamina: updatedStats.max.stamina,
        current_charge: updatedStats.current.charge,
        max_charge: updatedStats.max.charge,
        current_bandwidth: updatedStats.current.bandwidth,
        max_bandwidth: updatedStats.max.bandwidth,
        current_thermal: updatedStats.current.thermal,
        max_thermal: updatedStats.max.thermal,
        current_neural: updatedStats.current.neural,
        max_neural: updatedStats.max.neural
      }
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/travel');
  }
}
