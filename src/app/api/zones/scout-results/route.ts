import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { RowDataPacket } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';
import { validateFid, requireParams } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const body = await request.json();
    requireParams(body, ['historyId']);
    const { historyId } = body;

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Get zone_id from history
    const [historyRows] = await pool.execute<any[]>(
      'SELECT zone_id FROM user_zone_history WHERE id = ?',
      [historyId]
    );
    const zoneId = historyRows[0]?.zone_id;

    // Get user's street cred for encounter filtering
    const [userDataRows] = await pool.execute<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    // Award base XP for completing scout (random 10-30)
    const baseXpOptions = [10, 15, 20, 25, 30];
    const baseXp = baseXpOptions[Math.floor(Math.random() * baseXpOptions.length)];

    // Get arsenal discovery_poi bonus from equipped arsenal items
    const [arsenalBonus] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(am.discovery_poi), 0) as discovery_poi_bonus
       FROM user_loadout ul
       INNER JOIN arsenal_modifiers am ON ul.item_id = am.item_id
       WHERE ul.user_id = ? AND ul.slot_type = 'arsenal'`,
      [userId]
    );
    const discoveryPoiBonus = arsenalBonus[0]?.discovery_poi_bonus || 0;

    // Roll for reward type with POI discovery mechanics (28.6% base + arsenal bonus)
    const rewardType = rollEncounterReward(0, 0, discoveryPoiBonus, 'poi');
    
    let encounter = null;
    let unlockedPOI = null;
    let discoveryBonus = 0;

    if (rewardType === 'discovery') {
      // Try to unlock a POI (terminal or shop) in this zone
      const [undiscoveredPOIRows] = await pool.execute<any[]>(
        `SELECT poi.id, poi.name, poi.poi_type, poi.image_url
         FROM points_of_interest poi
         WHERE poi.zone_id = ?
           AND poi.id NOT IN (
             SELECT DISTINCT poi_id 
             FROM user_zone_history 
             WHERE user_id = ? AND poi_id IS NOT NULL AND action_type = 'UnlockedPOI'
           )
         ORDER BY RAND()
         LIMIT 1`,
        [zoneId, userId]
      );

      if (undiscoveredPOIRows.length > 0) {
        unlockedPOI = undiscoveredPOIRows[0];

        // +10 XP bonus for POI discovery
        discoveryBonus = 10;

        // Create POI unlock entry in user_zone_history
        await pool.execute(
          `INSERT INTO user_zone_history 
           (user_id, zone_id, poi_id, action_type, timestamp, result_status) 
           VALUES (?, ?, ?, 'UnlockedPOI', UTC_TIMESTAMP(), 'completed')`,
          [userId, zoneId, unlockedPOI.id]
        );

        // Determine POI type for logging
        const poiTypeLabel = unlockedPOI.poi_type === 'shop' ? 'shop' : 'terminal';
        
        // Log POI unlock activity
        await logActivity(
          userId,
          'discovery',
          'poi_unlocked',
          null,
          unlockedPOI.id,
          `Unlocked ${unlockedPOI.name} (${poiTypeLabel}) in zone ${zoneId}`
        );
      }
    } else if (rewardType === 'encounter') {
      // Get random encounter for city context with the specific zone
      encounter = await getRandomEncounter(pool, zoneId, 'city', userStreetCred);
      
      if (encounter) {
        // Log encounter trigger
        await logActivity(
          userId,
          'encounter',
          'triggered',
          null,
          encounter.id,
          `Encountered ${encounter.name} while scouting zone ${zoneId}`
        );
      }
    }

    // Apply total XP (base + discovery bonus)
    const totalXp = baseXp + discoveryBonus;
    await pool.execute(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [totalXp, userId]
    );

    // Build gains text
    let gainsText = `+${totalXp} XP`;
    if (unlockedPOI) {
      gainsText += ` (+10 discovery bonus), Unlocked ${unlockedPOI.name}`;
    } else if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    // Update history row with results
    await pool.execute(
      `UPDATE user_zone_history 
       SET result_status = 'completed',
           xp_data = ?,
           gains_data = ?
       WHERE id = ? AND user_id = ?`,
      [totalXp, gainsText, historyId, userId]
    );

    // Log scout completion activity
    await logActivity(
      userId,
      'action',
      'scout_completed',
      totalXp,
      zoneId,
      `Completed scouting zone ${zoneId}, gained ${totalXp} XP`
    );

    // Restore bandwidth using StatsService
    const statsService = new StatsService(pool, userId);
    await statsService.modifyStats({
      bandwidth: 1  // +1 to restore
    });

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

    return NextResponse.json({
      success: true,
      rewardType,
      xpGained: totalXp,
      gainsText,
      unlockedPOI: unlockedPOI ? {
        id: unlockedPOI.id,
        name: unlockedPOI.name,
        type: unlockedPOI.poi_type,
        imageUrl: unlockedPOI.image_url
      } : null,
      encounter: encounter ? {
        id: encounter.id,
        name: encounter.name,
        type: encounter.encounter_type,
        sentiment: encounter.default_sentiment,
        imageUrl: encounter.image_url
      } : null,
      message: 'Scout completed successfully',
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (err: any) {
    logger.error('Scout results error', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    return handleApiError(err, 'Failed to process scout results');
  }
}
