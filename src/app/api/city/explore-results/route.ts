import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { StatsService } from '../../../../lib/statsService';
import { validateFid, requireParams } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';
import { triggerJunkMessageWithProbability } from '../../../../lib/messageScheduler';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  try {
    const dbPool = await getDbPool();
    const body = await request.json();
    requireParams(body, ['historyId']);
    const { historyId } = body;

    const userId = await getUserIdByFid(dbPool, fid);

    // Get user's street cred for encounter filtering
    const [userDataRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    // Award base XP (random 10-25)
    const baseXpOptions = [10, 15, 20, 25];
    const baseXp = baseXpOptions[Math.floor(Math.random() * baseXpOptions.length)];

    // Get user's discovery progress for dynamic probability
    const [discoveryStats] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        (SELECT COUNT(DISTINCT zone_id) FROM user_zone_history WHERE user_id = ? AND zone_id IS NOT NULL) as discovered,
        (SELECT COUNT(*) FROM zones z 
         INNER JOIN zone_districts zd ON z.district = zd.id 
         LEFT JOIN zone_type zt ON z.zone_type = zt.id
         WHERE zd.active = 1 AND (zt.name IS NULL OR zt.name != 'underground')) as total
      `,
      [userId]
    );
    const discoveredCount = discoveryStats[0]?.discovered || 0;
    const totalZones = discoveryStats[0]?.total || 1;
    const undiscoveredCount = Math.max(0, totalZones - discoveredCount);

    // Get arsenal discovery bonuses from equipped arsenal items
    const [arsenalBonus] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        COALESCE(SUM(am.discovery_zone), 0) as discovery_zone_bonus,
        COALESCE(SUM(am.discovery_item), 0) as discovery_item_bonus
       FROM user_loadout ul
       INNER JOIN arsenal_modifiers am ON ul.item_id = am.item_id
       WHERE ul.user_id = ? AND ul.slot_type = 'arsenal'`,
      [userId]
    );
    const discoveryZoneBonus = arsenalBonus[0]?.discovery_zone_bonus || 0;
    const discoveryItemBonus = arsenalBonus[0]?.discovery_item_bonus || 0;

    // Roll for reward type: zone discovery OR item OR encounter OR nothing
    const rewardType = rollEncounterReward(discoveredCount, totalZones, discoveryZoneBonus, discoveryItemBonus, 'zone');
    logger.info('Explore reward rolled', { 
      fid, 
      userId,
      rewardType, 
      discoveredCount, 
      undiscoveredCount,
      progressRatio: (discoveredCount / totalZones).toFixed(2)
    });
    
    let discoveredZone = null;
    let discoveredItem = null;
    let encounter = null;
    let discoveryBonus = 0;

    if (rewardType === 'discovery') {
      // Get undiscovered zones from active districts
      const [undiscoveredZonesRows] = await dbPool.query<RowDataPacket[]>(
        `SELECT z.id, z.name, z.zone_type, z.district, z.description, z.image_url,
                zd.name as district_name,
                (SELECT COUNT(*) FROM points_of_interest WHERE zone_id = z.id) as poi_count
         FROM zones z
         INNER JOIN zone_districts zd ON z.district = zd.id
         LEFT JOIN zone_type zt ON z.zone_type = zt.id
         WHERE zd.active = 1
           AND (zt.name IS NULL OR zt.name != 'underground')
           AND z.id NOT IN (
             SELECT DISTINCT zone_id 
             FROM user_zone_history 
             WHERE user_id = ? AND zone_id IS NOT NULL
           )
         ORDER BY RAND()
         LIMIT 1`,
        [userId]
      );
      
      logger.info('Zone discovery query executed', {
        userId,
        fid,
        zonesFound: undiscoveredZonesRows.length
      });

      if (undiscoveredZonesRows.length > 0) {
        discoveredZone = undiscoveredZonesRows[0];
        
        logger.info('Zone discovered!', {
          userId,
          fid,
          zoneName: discoveredZone.name,
          zoneId: discoveredZone.id,
          district: discoveredZone.district_name,
          poiCount: discoveredZone.poi_count
        });

        // Update history with discovered zone ID
        await dbPool.query(
          'UPDATE user_zone_history SET discovered = ? WHERE id = ?',
          [discoveredZone.id, historyId]
        );

        // +10 XP bonus for discovery
        discoveryBonus = 10;

        // Create an initial entry for the discovered zone
        await dbPool.query(
          `INSERT INTO user_zone_history 
           (user_id, zone_id, action_type, timestamp, result_status) 
           VALUES (?, ?, 'Discovered', UTC_TIMESTAMP(), 'completed')`,
          [userId, discoveredZone.id]
        );

        // Log zone discovery activity
        await logActivity(
          userId,
          'discovery',
          'zone_discovered',
          null,
          discoveredZone.id,
          `Discovered ${discoveredZone.name} in ${discoveredZone.district_name}`
        );

        // Trigger junk message with 1-in-20 probability
        await triggerJunkMessageWithProbability(userId, 0.05, 'ZONE_DISCOVERY');
      } else {
        logger.warn('Discovery rolled but no zones available', {
          userId,
          fid,
          discoveredCount,
          totalZones
        });
      }
    } else if (rewardType === 'item') {
      // Try to discover a discoverable item (non-intel only for Explore)
      const [undiscoveredItemRows] = await dbPool.query<RowDataPacket[]>(
        `SELECT i.id, i.name, i.item_type, i.image_url, i.rarity
         FROM items i
         WHERE i.discoverable = 1
           AND i.item_type != 'intel'
           AND i.id NOT IN (
             SELECT DISTINCT item_id 
             FROM user_inventory 
             WHERE user_id = ?
           )
         ORDER BY RAND()
         LIMIT 1`,
        [userId]
      );

      logger.info('Item discovery rolled', {
        userId,
        fid,
        itemsFound: undiscoveredItemRows.length,
        rewardType
      });

      if (undiscoveredItemRows.length > 0) {
        discoveredItem = undiscoveredItemRows[0];

        // +10 XP bonus for item discovery
        discoveryBonus = 10;

        // Add item to user's inventory
        await dbPool.query(
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
          `Discovered ${discoveredItem.name} (${discoveredItem.item_type}) while exploring`
        );
      }
    } else if (rewardType === 'encounter') {
      // Get random encounter for city context (zone_id = 1 for generic city encounters)
      encounter = await getRandomEncounter(dbPool, 1, 'city', userStreetCred);
      logger.debug('Encounter found for explore', { 
        encounterName: encounter?.name || 'none',
        encounterType: encounter?.encounter_type 
      });
      
      if (encounter) {
        // Log encounter trigger
        await logActivity(
          userId,
          'encounter',
          'triggered',
          null,
          encounter.id,
          `Encountered ${encounter.name} during exploration`
        );
      }
    }

    // Apply total XP (base + discovery bonus)
    const totalXp = baseXp + discoveryBonus;
    await dbPool.query(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [totalXp, userId]
    );

    // Build gains text
    let gainsText = `+${totalXp} XP`;
    if (discoveredZone) {
      const poiInfo = discoveredZone.poi_count > 0 
        ? ` (${discoveredZone.poi_count} POI${discoveredZone.poi_count !== 1 ? 's' : ''})`
        : '';
      gainsText += ` (+10 discovery bonus), 🗺️ Discovered ${discoveredZone.name}${poiInfo}`;
    } else if (discoveredItem) {
      gainsText += ` (+10 discovery bonus), Discovered ${discoveredItem.name}`;
    } else if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    // Update history record
    await dbPool.query(
      `UPDATE user_zone_history 
       SET result_status = 'completed', 
           xp_data = 75, 
           gains_data = ? 
       WHERE id = ?`,
      [gainsText, historyId]
    );

    // Restore bandwidth using StatsService
    const statsService = new StatsService(dbPool, userId);
    await statsService.modifyStats({
      bandwidth: 1  // +1 to restore
    });

    // Log explore completion activity
    await logActivity(
      userId,
      'action',
      'explore_completed',
      75,
      null,
      discoveredZone ? `Completed exploration, gained 75 XP and discovered ${discoveredZone.name}` : 'Completed exploration, gained 75 XP'
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

    // 5% chance to schedule a junk message after exploring
    try {
      await triggerJunkMessageWithProbability(userId, 0.05, 'EXPLORE_COMPLETE');
    } catch (err) {
      logger.warn('[Explore Results] Failed to trigger junk message', { error: err });
    }

    return NextResponse.json({
      success: true,
      xpGained: totalXp,
      rewardType,
      discoveredZone: discoveredZone ? {
        id: discoveredZone.id,
        name: discoveredZone.name,
        zoneType: discoveredZone.zone_type,
        district: discoveredZone.district,
        districtName: discoveredZone.district_name,
        description: discoveredZone.description,
        imageUrl: discoveredZone.image_url,
        poiCount: discoveredZone.poi_count
      } : null,
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
      discoveryProgress: {
        discovered: discoveredCount,
        total: totalZones,
        remaining: undiscoveredCount,
        percentage: Math.round((discoveredCount / totalZones) * 100)
      },
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (error: any) {
    logger.error('Explore results error', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return handleApiError(error, 'Failed to process explore results');
  }
}
