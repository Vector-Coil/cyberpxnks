import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';
import { getUserByFid } from '../../../../lib/api/userUtils';
import { validateFid, handleApiError, requireParams } from '../../../../lib/api/errors';
import { validateResources } from '../../../../lib/game/resourceValidator';
import { ACTION_COSTS, COOLDOWNS } from '../../../../lib/game/constants';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid'), 300187);

    const body = await request.json();
    requireParams(body, ['poiId', 'zoneId']);
    const { poiId, zoneId } = body;

    logger.apiRequest('POST', '/api/zones/breach', { fid, poiId, zoneId });

    const pool = await getDbPool();

    // Get user with location
    const [userRows] = await pool.execute<any[]>(
      'SELECT id, fid, username, location FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine if this is a physical or remote breach
    const isPhysicalBreach = user.location === zoneId;
    const costs = isPhysicalBreach 
      ? ACTION_COSTS.ZONE_BREACH_PHYSICAL 
      : ACTION_COSTS.ZONE_BREACH_REMOTE;
    const chargeCost = costs.charge || 0;
    const staminaCost = costs.stamina || 0;

    // Verify user has unlocked this POI (via user_zone_history)
    const [poiAccessRows] = await pool.execute<any[]>(
      'SELECT poi_id FROM user_zone_history WHERE user_id = ? AND poi_id = ? AND action_type = \'UnlockedPOI\' LIMIT 1',
      [user.id, poiId]
    );

    if (poiAccessRows.length === 0) {
      return NextResponse.json({ error: 'POI not unlocked' }, { status: 403 });
    }

    // Get POI details
    const [poiRows] = await pool.execute<any[]>(
      'SELECT id, name, zone_id FROM points_of_interest WHERE id = ? LIMIT 1',
      [poiId]
    );
    const poi = (poiRows as any[])[0];

    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(pool, user.id);
    const fullStats = await statsService.getStats();
    const stats = fullStats;

    // Count currently active jobs
    const [activeJobsRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring', 'RemoteBreach', 'OvernetScan')
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [user.id]
    );
    const activeCount = (activeJobsRows as any[])[0]?.active_count || 0;

    if (activeCount >= stats.max.bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max.bandwidth})` }, { status: 400 });
    }

    // Validate resources
    validateResources(stats.current, costs, stats.max);

    // Check if user already has an active breach on THIS specific POI
    const [activeBreachRows] = await pool.execute<any[]>(
      `SELECT id FROM user_zone_history 
       WHERE user_id = ? AND poi_id = ? AND action_type IN ('Breached', 'RemoteBreach')
       AND (result_status IS NULL OR result_status = '') 
       AND end_time > UTC_TIMESTAMP()
       LIMIT 1`,
      [user.id, poiId]
    );

    if (activeBreachRows.length > 0) {
      return NextResponse.json({ error: 'Already breaching this terminal' }, { status: 400 });
    }

    // Deduct resources using StatsService
    const statChanges: any = {
      charge: -chargeCost,
      bandwidth: -1
    };
    if (isPhysicalBreach) {
      statChanges.stamina = -staminaCost;
    }
    await statsService.modifyStats(statChanges);

    // Create breach action
    const endTime = new Date(Date.now() + COOLDOWNS.ZONE_BREACH);
    const breachType = isPhysicalBreach ? 'Breached' : 'RemoteBreach';
    logger.info('Creating breach', { userId: user.id, zoneId, poiId, breachType, isPhysicalBreach });
    const [insertResult] = await pool.execute<any>(
      `INSERT INTO user_zone_history (user_id, zone_id, action_type, timestamp, end_time, poi_id)
       VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
      [user.id, zoneId, breachType, endTime, poiId]
    );

    const historyId = (insertResult as any).insertId;
    logger.info('Breach created', { historyId, userId: user.id, poiId });

    // Log activity
    await logActivity(
      user.id,
      'action',
      'breach_started',
      60, // seconds (testing)
      poiId,
      `Started breaching ${poi.name}`
    );

    // Get updated stats using StatsService
    const updatedStatsService = new StatsService(pool, user.id);
    const updatedFullStats = await updatedStatsService.getStats();
    const updatedStats = {
      current_consciousness: updatedFullStats.current.consciousness,
      max_consciousness: updatedFullStats.max.consciousness,
      current_stamina: updatedFullStats.current.stamina,
      max_stamina: updatedFullStats.max.stamina,
      current_bandwidth: updatedFullStats.current.bandwidth,
      max_bandwidth: updatedFullStats.max.bandwidth,
      current_charge: updatedFullStats.current.charge,
      max_charge: updatedFullStats.max.charge,
      current_thermal: updatedFullStats.current.thermal,
      max_thermal: updatedFullStats.max.thermal,
      current_neural: updatedFullStats.current.neural,
      max_neural: updatedFullStats.max.neural
    };

    return NextResponse.json({
      success: true,
      breachAction: {
        id: historyId,
        action_type: 'Breached',
        end_time: endTime.toISOString()
      },
      updatedStats
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/zones/breach');
  }
}
