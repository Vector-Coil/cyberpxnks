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
    const { zoneId, staminaCost } = body;

    requireParams(body, ['zoneId', 'staminaCost']);

    logger.apiRequest('POST', '/api/zones/scout', { fid, zoneId, staminaCost });

    const pool = await getDbPool();
    const user = await getUserByFid(pool, fid);

    // Get current stats using StatsService
    const statsService = new StatsService(pool, user.id);
    const stats = await statsService.getStats();

    // Validate resource requirements
    validateResources(
      stats.current,
      {
        stamina: staminaCost,
        bandwidth: 1,
        minConsciousnessPercent: 0.5
      },
      stats.max
    );

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
      return NextResponse.json({ 
        error: `Maximum concurrent actions reached (${stats.max.bandwidth})` 
      }, { status: 400 });
    }

    // Check for existing active scout in this zone
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

    // Deduct costs using StatsService
    await statsService.modifyStats({
      stamina: -staminaCost,
      bandwidth: -1
    });

    // Create scout action in history
    const timestamp = new Date();
    const endTime = new Date(timestamp.getTime() + COOLDOWNS.ZONE_SCOUT);

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

    // Fetch updated stats using StatsService
    const updatedStatsService = new StatsService(pool, user.id);
    const fullStats = await updatedStatsService.getStats();
    const updatedStats = {
      current_consciousness: fullStats.current.consciousness,
      max_consciousness: fullStats.max.consciousness,
      current_stamina: fullStats.current.stamina,
      max_stamina: fullStats.max.stamina,
      current_bandwidth: fullStats.current.bandwidth,
      max_bandwidth: fullStats.max.bandwidth,
      current_charge: fullStats.current.charge,
      max_charge: fullStats.max.charge
    };

    // Fetch the created scout action
    const [scoutRows] = await pool.execute<any[]>(
      'SELECT * FROM user_zone_history WHERE id = ? LIMIT 1',
      [(insertResult as any).insertId]
    );

    logger.info('Scout action created', { userId: user.id, zoneId, scoutId: (insertResult as any).insertId });

    return NextResponse.json({
      success: true,
      scoutAction: scoutRows[0],
      updatedStats
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/zones/scout');
  }
}
