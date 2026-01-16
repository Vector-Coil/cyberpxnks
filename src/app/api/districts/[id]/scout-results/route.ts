import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { rollEncounterReward, getRandomEncounter } from '../../../../../lib/encounterUtils';
import { StatsService } from '../../../../../lib/statsService';
import { validateFid, requireParams, handleApiError } from '../../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../../lib/api/userUtils';
import { logger } from '../../../../../lib/logger';
import { triggerJunkMessageWithProbability } from '../../../../../lib/messageScheduler';

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const districtsIndex = pathParts.indexOf('districts');
    const districtId = parseInt(pathParts[districtsIndex + 1], 10);

    const fid = validateFid(url.searchParams.get('fid'));
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

    // Get user's discovery progress for district-specific probability
    const [discoveryStats] = await dbPool.query<RowDataPacket[]>(
      `SELECT 
        (SELECT COUNT(DISTINCT uzh.zone_id) FROM user_zone_history uzh JOIN zones z ON uzh.zone_id = z.id WHERE uzh.user_id = ? AND z.district = ?) as discovered,
        (SELECT COUNT(*) FROM zones z 
         INNER JOIN zone_districts zd ON z.district = zd.id 
         LEFT JOIN zone_type zt ON z.zone_type = zt.id
         WHERE zd.active = 1 AND z.district = ? AND (zt.name IS NULL OR zt.name != 'underground')) as total
      `,
      [userId, districtId, districtId]
    );

    const discoveredCount = discoveryStats[0]?.discovered || 0;
    const totalZones = discoveryStats[0]?.total || 1;
    const undiscoveredCount = Math.max(0, totalZones - discoveredCount);

    // Get arsenal discovery bonuses
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

    // Roll for reward type
    const rewardType = rollEncounterReward(discoveredCount, totalZones, discoveryZoneBonus, discoveryItemBonus, 'zone');

    let discoveredZone = null;
    let discoveredItem = null;
    let encounter = null;
    let discoveryBonus = 0;

    if (rewardType === 'discovery') {
      // Get undiscovered zones FROM THIS DISTRICT only and exclude underground
      const [undiscoveredZonesRows] = await dbPool.query<RowDataPacket[]>(
        `SELECT z.id, z.name, z.zone_type, z.district, z.description, z.image_url,
                (SELECT COUNT(*) FROM points_of_interest WHERE zone_id = z.id) as poi_count,
                zd.name as district_name
         FROM zones z
         INNER JOIN zone_districts zd ON z.district = zd.id
         LEFT JOIN zone_type zt ON z.zone_type = zt.id
         WHERE zd.active = 1
           AND z.district = ?
           AND (zt.name IS NULL OR zt.name != 'underground')
           AND z.id NOT IN (
             SELECT DISTINCT zone_id 
             FROM user_zone_history 
             WHERE user_id = ? AND zone_id IS NOT NULL
           )
         ORDER BY RAND()
         LIMIT 1`,
        [districtId, userId]
      );

      if (undiscoveredZonesRows.length > 0) {
        discoveredZone = undiscoveredZonesRows[0];

        // Update history with discovered zone ID
        await dbPool.query('UPDATE user_zone_history SET discovered = ? WHERE id = ?', [discoveredZone.id, historyId]);

        discoveryBonus = 10;

        await dbPool.query(`INSERT INTO user_zone_history (user_id, zone_id, action_type, timestamp, result_status) VALUES (?, ?, 'Discovered', UTC_TIMESTAMP(), 'completed')`, [userId, discoveredZone.id]);

        await logActivity(userId, 'discovery', 'zone_discovered', null, discoveredZone.id, `Discovered ${discoveredZone.name} in ${discoveredZone.district_name}`);

        await triggerJunkMessageWithProbability(userId, 0.05, 'ZONE_DISCOVERY');
      }
    } else if (rewardType === 'item') {
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

      if (undiscoveredItemRows.length > 0) {
        discoveredItem = undiscoveredItemRows[0];
        discoveryBonus = 10;

        await dbPool.query(`INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at) VALUES (?, ?, 1, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE quantity = quantity + 1`, [userId, discoveredItem.id]);

        await logActivity(userId, 'discovery', 'item_discovered', null, discoveredItem.id, `Discovered ${discoveredItem.name} (${discoveredItem.item_type}) while scouting district`);
      }
    } else if (rewardType === 'encounter') {
      encounter = await getRandomEncounter(dbPool, 1, 'city', userStreetCred);
      if (encounter) {
        await logActivity(userId, 'encounter', 'triggered', null, encounter.id, `Encountered ${encounter.name} while scouting district`);
      }
    }

    const totalXp = baseXp + discoveryBonus;
    await dbPool.query('UPDATE users SET xp = xp + ? WHERE id = ?', [totalXp, userId]);

    let gainsText = `+${totalXp} XP`;
    if (discoveredZone) {
      const poiInfo = discoveredZone.poi_count > 0 ? ` (${discoveredZone.poi_count} POI${discoveredZone.poi_count !== 1 ? 's' : ''})` : '';
      gainsText += ` (+10 discovery bonus), 🗺️ Discovered ${discoveredZone.name}${poiInfo}`;
    } else if (discoveredItem) {
      gainsText += ` (+10 discovery bonus), Discovered ${discoveredItem.name}`;
    } else if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    await dbPool.query(`UPDATE user_zone_history SET result_status = 'completed', xp_data = 75, gains_data = ? WHERE id = ?`, [gainsText, historyId]);

    const statsService = new StatsService(dbPool, userId);
    await statsService.modifyStats({ bandwidth: 1 });

    try {
      await triggerJunkMessageWithProbability(userId, 0.05, 'EXPLORE_COMPLETE');
    } catch (err) {
      logger.warn('[District Scout Results] Failed to trigger junk message', { error: err });
    }

    return NextResponse.json({
      success: true,
      historyId: historyId,
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
      }
    });
  } catch (error: any) {
    return handleApiError(error, 'POST /api/districts/[id]/scout-results');
  }
}
