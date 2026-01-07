import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';
import { getUserByFid } from '../../../../lib/api/userUtils';
import { validateFid, handleApiError, requireParams } from '../../../../lib/api/errors';
import { validateResources } from '../../../../lib/game/resourceValidator';
import { ACTION_COSTS, COOLDOWNS } from '../../../../lib/game/constants';
import { logger } from '../../../../lib/logger';
import { calculateBreachSuccessRate } from '../../../../lib/game/breachUtils';

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

    // Get POI details including breach_difficulty
    const [poiRows] = await pool.execute<any[]>(
      'SELECT id, name, zone_id, breach_difficulty FROM points_of_interest WHERE id = ? LIMIT 1',
      [poiId]
    );
    const poi = (poiRows as any[])[0];

    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // Check for active cooldown on this POI
    const [cooldownRows] = await pool.execute<any[]>(
      `SELECT cooldown_until FROM user_zone_history
       WHERE user_id = ? AND poi_id = ?
       AND cooldown_until IS NOT NULL
       AND cooldown_until > UTC_TIMESTAMP()
       ORDER BY cooldown_until DESC
       LIMIT 1`,
      [user.id, poiId]
    );

    if (cooldownRows.length > 0) {
      const cooldownUntil = new Date(cooldownRows[0].cooldown_until);
      return NextResponse.json({ 
        error: 'Terminal on cooldown after failed breach',
        cooldown_until: cooldownUntil.toISOString()
      }, { status: 400 });
    }

    // Get zone district level for success rate calculation
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT z.id, z.district, COALESCE(zd.level, zd.phase, 1) as district_level
       FROM zones z
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE z.id = ?
       LIMIT 1`,
      [zoneId]
    );
    const zone = (zoneRows as any[])[0];
    const districtLevel = zone?.district_level || 1;

    // Get user level
    const [userLevelRows] = await pool.execute<any[]>(
      'SELECT level FROM users WHERE id = ? LIMIT 1',
      [user.id]
    );
    const userLevel = userLevelRows[0]?.level || 1;

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

    // Check for active physical presence actions (Explore or Scout) - ONLY for physical breaches
    // Remote breaches don't require physical presence and can run alongside other actions
    if (isPhysicalBreach) {
      const [physicalPresenceRows] = await pool.execute<any[]>(
        `SELECT id, action_type, end_time
         FROM user_zone_history
         WHERE user_id = ?
           AND action_type IN ('Exploring', 'Scouted')
           AND end_time > UTC_TIMESTAMP()
           AND (result_status IS NULL OR result_status = '')
         LIMIT 1`,
        [user.id]
      );

      if (physicalPresenceRows.length > 0) {
        const conflictingAction = physicalPresenceRows[0];
        const actionName = conflictingAction.action_type === 'Exploring' ? 'Explore' : 'Scout';
        logger.warn('Blocked by physical presence action', { userId: user.id, conflictingAction });
        return NextResponse.json({
          error: `Cannot perform physical breach while ${actionName} is in progress. Only one physical action can be active at a time.`
        }, { status: 400 });
      }
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

    // Fetch equipped cyberdeck tier (safe fallback on DB errors)
    let deckTier = 0;
    try {
      const [deckRows] = await pool.execute<any[]>(
        `SELECT i.tier FROM user_loadout ul
         INNER JOIN items i ON ul.item_id = i.id
         WHERE ul.user_id = ? AND ul.slot_type = 'cyberdeck' AND ul.is_equipped = 1
         LIMIT 1`,
        [user.id]
      );
      deckTier = (deckRows as any[])[0]?.tier || 0;
    } catch (err) {
      logger.warn('Failed to fetch deck tier, defaulting to 0', { userId: user.id, err });
      deckTier = 0;
    }

    // Fetch highest slimsoft tier that affects decryption (safe fallback)
    let slimsoftTier = 0;
    try {
      const [ssTierRows] = await pool.execute<any[]>(
        `SELECT MAX(i.tier) as ss_decryption_tier FROM user_loadout ul
         INNER JOIN items i ON ul.item_id = i.id
         INNER JOIN slimsoft_effects se ON i.id = se.item_id
         WHERE ul.user_id = ? AND ul.slot_type = 'slimsoft' AND ul.is_equipped = 1 AND se.target_stat = 'decryption'`,
        [user.id]
      );
      slimsoftTier = (ssTierRows as any[])[0]?.ss_decryption_tier || 0;
    } catch (err) {
      logger.warn('Failed to fetch slimsoft tier, defaulting to 0', { userId: user.id, err });
      slimsoftTier = 0;
    }

    // Calculate breach success rate for client display
    const successRateData = calculateBreachSuccessRate({
      decryption: stats.tech.decryption || 0,
      interfaceStat: stats.attributes.interface || 0,
      cache: stats.tech.cache || 0,
      userLevel,
      districtLevel,
      breachDifficulty: poi.breach_difficulty || 0,
      deckTier,
      slimsoftTier,
      clockSpeed: stats.tech.clock_speed || 0,
      latency: stats.tech.latency || 0,
      signalNoise: stats.tech.signal_noise || 0,
      slimsoftPct: stats.slimsoft?.decryption_pct || 0
    });

    // Create breach action
    const endTime = new Date(Date.now() + COOLDOWNS.ZONE_BREACH);
    const breachType = isPhysicalBreach ? 'Breached' : 'RemoteBreach';
    logger.info('Creating breach', { userId: user.id, zoneId, poiId, breachType, isPhysicalBreach, successRate: successRateData.successRate });
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
      successRate: successRateData,
      updatedStats
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/zones/breach');
  }
}
