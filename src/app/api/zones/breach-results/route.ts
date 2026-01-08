import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid, requireParams } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';
import { triggerJunkMessageWithProbability } from '../../../../lib/messageScheduler';
import { StatsService } from '../../../../lib/statsService';
import { 
  calculateBreachSuccessRate, 
  rollBreachSuccess, 
  rollCriticalFailure,
  getBreachFailurePenalties,
  calculateFailureXP
} from '../../../../lib/game/breachUtils';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const body = await request.json();
    requireParams(body, ['historyId']);
    const { historyId, poiId } = body;

    logger.debug('Breach results request', { fid, historyId, poiId });

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Verify this is the user's breach and it's complete (both physical and remote breaches)
    const [breachRows] = await pool.execute<any[]>(
      `SELECT id, zone_id, end_time, result_status, action_type FROM user_zone_history 
       WHERE id = ? AND user_id = ? AND action_type IN ('Breached', 'RemoteBreach')
       LIMIT 1`,
      [historyId, userId]
    );

    logger.debug('Breach query result', { 
      fid,
      historyId, 
      userId,
      foundRows: breachRows.length,
      breach: breachRows[0] 
    });

    if (breachRows.length === 0) {
      // Try to find ANY breach for this user to help debug
      const [debugRows] = await pool.execute<any[]>(
        `SELECT id, action_type, result_status, poi_id FROM user_zone_history 
         WHERE user_id = ? AND action_type IN ('Breached', 'RemoteBreach') ORDER BY timestamp DESC LIMIT 3`,
        [userId]
      );
      logger.warn('Breach not found', { fid, historyId, recentBreaches: debugRows });
      return NextResponse.json({ error: 'Breach not found or already completed', debug: { searched: historyId, found: debugRows } }, { status: 404 });
    }

    const breach = breachRows[0];
    
    if (breach.result_status && breach.result_status !== '') {
      logger.info('Breach already completed', { fid, historyId, resultStatus: breach.result_status });
      return NextResponse.json({ error: 'Breach already completed' }, { status: 400 });
    }

    // Check if breach is complete
    const now = new Date();
    const endTime = new Date(breach.end_time);
    if (now < endTime) {
      return NextResponse.json({ error: 'Breach not yet complete' }, { status: 400 });
    }

    // Get POI details including breach_difficulty and subnet
    const [poiDetailsRows] = await pool.execute<any[]>(
      'SELECT id, name, zone_id, breach_difficulty, subnet_id FROM points_of_interest WHERE id = ? LIMIT 1',
      [poiId]
    );
    const poiDetails = poiDetailsRows[0];

    // Resolve subnet name for the POI if available
    let poiSubnetName: string | null = null;
    if (poiDetails?.subnet_id) {
      try {
        const [subnetRows] = await pool.execute<any[]>(
          'SELECT name FROM subnets WHERE id = ? LIMIT 1',
          [poiDetails.subnet_id]
        );
        poiSubnetName = (subnetRows[0]?.name || null);
      } catch (e) {
        logger.warn('Failed to fetch subnet name for POI', { poiId, error: e });
        poiSubnetName = null;
      }
    }

    // Get zone district level and user level for success calculation
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT z.id, z.district, COALESCE(zd.level, zd.phase, 1) as district_level
       FROM zones z
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE z.id = ?
       LIMIT 1`,
      [breach.zone_id]
    );
    const districtLevel = zoneRows[0]?.district_level || 1;

    const [userRows] = await pool.execute<any[]>(
      'SELECT id, level, location FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userLevel = userRows[0]?.level || 1;
    const userLocation = userRows[0]?.location;

    // Get user stats for success calculation
    const statsService = new StatsService(pool, userId);
    const fullStats = await statsService.getStats();

    // Calculate breach success rate
    const successRateData = calculateBreachSuccessRate({
      decryption: fullStats.tech.decryption || 0,
      interfaceStat: fullStats.attributes.interface || 0,
      cache: fullStats.tech.cache || 0,
      userLevel,
      districtLevel,
      breachDifficulty: poiDetails?.breach_difficulty || 0
    });

    // Roll for success/failure
    const isSuccess = rollBreachSuccess(successRateData.successRate);
    logger.info('Breach success roll', { 
      historyId, 
      userId, 
      successRate: successRateData.successRate, 
      isSuccess 
    });

    // === FAILURE PATH ===
    if (!isSuccess) {
      const isCriticalFailure = rollCriticalFailure();
      const penalties = getBreachFailurePenalties();
      
      // Calculate reduced XP (25% of base)
      const xpOptions = [30, 35, 40, 45, 50];
      const baseXp = xpOptions[Math.floor(Math.random() * xpOptions.length)];
      const failureXp = calculateFailureXP(baseXp);

      // Apply XP
      await pool.execute(
        'UPDATE users SET xp = xp + ? WHERE id = ?',
        [failureXp, userId]
      );

      // Apply failure penalties via StatsService
      await statsService.modifyStats({
        stamina: penalties.stamina,
        consciousness: penalties.consciousness,
        charge: penalties.charge,
        neural: penalties.neural,
        thermal: penalties.thermal
      });

      // Set cooldown (60 minutes)
      // Set cooldown (1 minute for testing)
      const cooldownUntil = new Date(Date.now() + 1 * 60 * 1000);
      
      // Mark breach as failed with cooldown
      await pool.execute(
        `UPDATE user_zone_history 
         SET result_status = 'failed', xp_data = ?, gains_data = ?, cooldown_until = ?
         WHERE id = ?`,
        [failureXp, `+${failureXp} XP (25% for failure)`, cooldownUntil, historyId]
      );

      // Restore bandwidth
      logger.debug('Restoring bandwidth (breach failure)', { fid, userId, historyId });
      await pool.execute(
        'UPDATE user_stats SET current_bandwidth = current_bandwidth + 1 WHERE user_id = ?',
        [userId]
      );
      try {
        const [bwRows] = await pool.execute<any[]>(
          'SELECT current_bandwidth FROM user_stats WHERE user_id = ? LIMIT 1',
          [userId]
        );
        logger.debug('Bandwidth after restore (failure)', { userId, current_bandwidth: bwRows[0]?.current_bandwidth });
      } catch (e) {
        logger.warn('Failed to read bandwidth after restore (failure)', { error: e, userId });
      }

      // Log failure
      await logActivity(
        userId,
        'action',
        'breach_failed',
        failureXp,
        poiId || null,
        `Failed breach of ${poiDetails?.name || 'terminal'}, gained ${failureXp} XP`
      );

      // Handle critical failure - trigger encounter
      let encounter = null;
      if (isCriticalFailure) {
        // Determine encounter type based on location
        const isPhysicalBreach = userLocation === breach.zone_id;
        const encounterType = isPhysicalBreach ? 'city' : 'grid';
        
        // Get user's street cred for encounter filtering
        const [userDataRows] = await pool.execute<RowDataPacket[]>(
          'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        const userStreetCred = userDataRows[0]?.street_cred || 0;

        // Get encounter
        encounter = await getRandomEncounter(pool, breach.zone_id, encounterType, userStreetCred);
        
        if (encounter) {
          await logActivity(
            userId,
            'encounter',
            'triggered',
            null,
            encounter.id,
            `Critical breach failure triggered ${encounter.name}`
          );
        }
      }

      // Get updated stats
      const updatedStatsService = new StatsService(pool, userId);
      const updatedFullStats = await updatedStatsService.getStats();

      return NextResponse.json({
        success: false,
        failed: true,
        criticalFailure: isCriticalFailure,
        historyId,
        xpGained: failureXp,
        penalties,
        cooldownUntil: cooldownUntil.toISOString(),
        encounter: encounter ? {
          id: encounter.id,
          name: encounter.name,
          type: encounter.encounter_type,
          sentiment: encounter.default_sentiment,
          imageUrl: encounter.image_url
        } : null,
        updatedStats: {
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
        }
      });
    }

    // === SUCCESS PATH (existing logic) ===
    // Award random XP (30-50 in increments of 5)
    // Note: Thermal/neural load increases are handled automatically by the regeneration system during breach

    // === CONDITIONAL GIG ITEM REWARD LOGIC ===
    // Award items with for_gig and found_where matching the user's started gigs and current breach action/location
    // 1. Get all started gigs for the user (case-insensitive)
    const [startedGigs] = await pool.execute<any[]>(
      `SELECT gh.gig_id
         FROM gig_history gh
        WHERE gh.user_id = ? AND LOWER(gh.status) = 'started'`,
      [userId]
    );

    const startedGigIds = startedGigs.map((g: any) => g.gig_id);

    if (startedGigIds.length > 0) {
      // 2. Find items with for_gig in startedGigIds and found_where matching this breach action/location
      // For breach, found_where can be 'breach_{poiId}', 'breach_{zoneId}', or 'breach_{subnetName}'
      const foundWhereOptions = [
        `breach_${poiId}`,
        `breach_${breach.zone_id}`
      ];
      if (poiSubnetName) {
        foundWhereOptions.push(`breach_${String(poiSubnetName).toLowerCase()}`);
      }

      const placeholdersForGigs = startedGigIds.map(() => '?').join(',');
      const placeholdersForFound = foundWhereOptions.map(() => '?').join(',');
      const query = `SELECT id, name FROM items WHERE for_gig IN (${placeholdersForGigs}) AND LOWER(found_where) IN (${placeholdersForFound})`;
      const params = [...startedGigIds, ...foundWhereOptions.map(f => String(f).toLowerCase())];
      const [gigItems] = await pool.execute<any[]>(query, params);
      for (const item of gigItems) {
        // Check if user already has the item
        const [hasItemRows] = await pool.execute<any[]>(
          `SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?`,
          [userId, item.id]
        );
        if (!hasItemRows.length) {
          // Grant item to user
          await pool.execute(
            `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at)
             VALUES (?, ?, 1, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [userId, item.id]
          );
          // Log activity
          await logActivity(
            userId,
            'gig',
            'item_reward_granted',
            null,
            item.id,
            `Granted gig item (${item.name}) for gig and breach at POI ${poiId}`
          );
        }
      }
    }
    const xpOptions = [30, 35, 40, 45, 50];
    const baseXp = xpOptions[Math.floor(Math.random() * xpOptions.length)];

    // Get arsenal discovery bonuses from equipped arsenal items
    const [arsenalBonus] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        COALESCE(SUM(am.discovery_poi), 0) as discovery_poi_bonus,
        COALESCE(SUM(am.discovery_item), 0) as discovery_item_bonus
       FROM user_loadout ul
       INNER JOIN arsenal_modifiers am ON ul.item_id = am.item_id
       WHERE ul.user_id = ? AND ul.slot_type = 'arsenal'`,
      [userId]
    );
    const discoveryPoiBonus = arsenalBonus[0]?.discovery_poi_bonus || 0;
    const discoveryItemBonus = arsenalBonus[0]?.discovery_item_bonus || 0;

    // Roll for reward type: item (intel only) OR encounter OR nothing
    // Note: No POI/terminal discovery during breach - terminals are discovered via Scout/Explore
    // Using 'poi' type but with 0 modifier to disable POI discovery, focus on item/encounter/nothing
    const rewardType = rollEncounterReward(0, 0, 0, discoveryItemBonus, 'poi');
    
    let discoveredItem = null;
    let discoveryBonus = 0;

    if (rewardType === 'item') {
      // Try to discover a discoverable item (intel only for Breach)
      const [undiscoveredItemRows] = await pool.execute<any[]>(
        `SELECT i.id, i.name, i.item_type, i.image_url, i.rarity
         FROM items i
         WHERE i.discoverable = 1
           AND i.item_type = 'intel'
           AND i.id NOT IN (
             SELECT DISTINCT item_id 
             FROM user_inventory 
             WHERE user_id = ?
           )
         ORDER BY RAND()
         LIMIT 1`,
        [userId]
      );

      if (undiscoveredItemRows.length > 0) {
        discoveredItem = undiscoveredItemRows[0];

        // +10 XP bonus for item discovery
        discoveryBonus = 10;

        // Add item to user's inventory
        await pool.execute(
          `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at)
           VALUES (?, ?, 1, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
          [userId, discoveredItem.id]
        );

        // Log item discovery activity
        await logActivity(
          userId,
          'discovery',
          'item_discovered',
          null,
          discoveredItem.id,
          `Discovered ${discoveredItem.name} (${discoveredItem.item_type}) while breaching zone ${breach.zone_id}`
        );
      }
    }

    // Get user's street cred for encounter filtering
    const [userDataRows] = await pool.execute<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    let encounter = null;
    if (rewardType === 'encounter') {
      // Get random encounter for city context with the specific zone
      encounter = await getRandomEncounter(pool, breach.zone_id, 'city', userStreetCred);
      
      if (encounter) {
        // Log encounter trigger
        await logActivity(
          userId,
          'encounter',
          'triggered',
          null,
          encounter.id,
          `Encountered ${encounter.name} while breaching zone ${breach.zone_id}`
        );
      }
    }

    // Apply total XP (base + discovery bonus)
    const totalXp = baseXp + discoveryBonus;
    
    // Roll for credits reward (0, 25, 50, or 100)
    const creditsOptions = [0, 25, 50, 100];
    const creditsGained = creditsOptions[Math.floor(Math.random() * creditsOptions.length)];
    
    // Update XP and credits
    await pool.execute(
      'UPDATE users SET xp = xp + ?, credits = credits + ? WHERE id = ?',
      [totalXp, creditsGained, userId]
    );

    // Build gains text
    let gainsText = `+${totalXp} XP`;
    if (creditsGained > 0) {
      gainsText += `, +${creditsGained} Credits`;
    }
    if (discoveredItem) {
      gainsText += ` (+10 discovery bonus), Discovered ${discoveredItem.name}`;
    } else if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    // Mark breach as complete with gains_data for display
    await pool.execute(
      `UPDATE user_zone_history 
       SET result_status = 'completed', xp_data = ?, gains_data = ?
       WHERE id = ?`,
      [totalXp, gainsText, historyId]
    );

    // Restore bandwidth AFTER marking as complete to prevent double-restoration on retry
    logger.debug('Restoring bandwidth (breach success)', { fid, userId, historyId });
    await pool.execute(
      'UPDATE user_stats SET current_bandwidth = current_bandwidth + 1 WHERE user_id = ?',
      [userId]
    );
    try {
      const [bwRows2] = await pool.execute<any[]>(
        'SELECT current_bandwidth FROM user_stats WHERE user_id = ? LIMIT 1',
        [userId]
      );
      logger.debug('Bandwidth after restore (success)', { userId, current_bandwidth: bwRows2[0]?.current_bandwidth });
    } catch (e) {
      logger.warn('Failed to read bandwidth after restore (success)', { error: e, userId });
    }

    // Get POI details for logging
    let poiName = 'Unknown Terminal';
    if (poiId) {
      const [poiRows] = await pool.execute<any[]>(
        'SELECT name FROM points_of_interest WHERE id = ? LIMIT 1',
        [poiId]
      );
      if (poiRows.length > 0) {
        poiName = poiRows[0].name;
      }
    }

    // Log breach completion activity
    const activityMessage = creditsGained > 0 
      ? `Completed breach of ${poiName}, gained ${totalXp} XP and ${creditsGained} Credits`
      : `Completed breach of ${poiName}, gained ${totalXp} XP`;
    
    await logActivity(
      userId,
      'action',
      'breach_completed',
      totalXp,
      poiId || null,
      activityMessage
    );

    // Check for level up
    let levelUpData = null;
    try {
      const levelUpRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/check-level-up?fid=${fid}`, {
        method: 'POST'
      });
      if (levelUpRes.ok) {
        levelUpData = await levelUpRes.json();
      }
    } catch (err) {
      logger.warn('Failed to check level up', { error: err });
    }

    // Get updated stats
    const [updatedStatsRows] = await pool.execute<any[]>(
      'SELECT * FROM user_stats WHERE user_id = ? LIMIT 1',
      [userId]
    );

    // 5% chance to schedule a junk message after breaching
    try {
      await triggerJunkMessageWithProbability(userId, 0.05, 'BREACH_COMPLETE');
    } catch (err) {
      logger.warn('[Breach Results] Failed to trigger junk message', { error: err });
    }

    return NextResponse.json({
      success: true,
      historyId: historyId,
      xpGained: totalXp,
      creditsGained: creditsGained,
      rewardType,
      discoveredItem: discoveredItem ? {
        id: discoveredItem.id,
        name: discoveredItem.name,
        type: discoveredItem.item_type,
        rarity: discoveredItem.rarity,
        imageUrl: discoveredItem.image_url
      } : null,
      encounter: encounter ? {
        id: encounter.id,
        name: encounter.name,
        type: encounter.encounter_type,
        sentiment: encounter.default_sentiment,
        imageUrl: encounter.image_url
      } : null,
      updatedStats: updatedStatsRows[0],
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to complete breach');
  }
}
