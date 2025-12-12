import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { RowDataPacket } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json({ error: 'Missing history ID' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get zone_id from history
    const [historyRows] = await pool.execute<any[]>(
      'SELECT zone_id FROM user_zone_history WHERE id = ?',
      [historyId]
    );
    const zoneId = historyRows[0]?.zone_id;

    // Get user's street cred for encounter filtering
    const [userDataRows] = await pool.execute<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [user.id]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    const xpGained = 50;

    // Update user XP
    await pool.execute(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [xpGained, user.id]
    );

    // Roll for reward type
    const rewardType = rollEncounterReward();
    
    let encounter = null;
    let unlockedPOI = null;

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
        [zoneId, user.id]
      );

      if (undiscoveredPOIRows.length > 0) {
        unlockedPOI = undiscoveredPOIRows[0];

        // Create POI unlock entry in user_zone_history
        await pool.execute(
          `INSERT INTO user_zone_history 
           (user_id, zone_id, poi_id, action_type, timestamp, result_status) 
           VALUES (?, ?, ?, 'UnlockedPOI', UTC_TIMESTAMP(), 'completed')`,
          [user.id, zoneId, unlockedPOI.id]
        );

        // Determine POI type for logging
        const poiTypeLabel = unlockedPOI.poi_type === 'shop' ? 'shop' : 'terminal';
        
        // Log POI unlock activity
        await logActivity(
          user.id,
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
          user.id,
          'encounter',
          'triggered',
          null,
          encounter.id,
          `Encountered ${encounter.name} while scouting zone ${zoneId}`
        );
      }
    }

    // Build gains text
    let gainsText = `+${xpGained} XP`;
    if (unlockedPOI) {
      gainsText += `, Unlocked ${unlockedPOI.name}`;
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
      [xpGained, gainsText, historyId, user.id]
    );

    // Log scout completion activity
    await logActivity(
      user.id,
      'action',
      'scout_completed',
      xpGained,
      zoneId,
      `Completed scouting zone ${zoneId}, gained ${xpGained} XP`
    );

    // Restore bandwidth using StatsService
    const statsService = new StatsService(pool, user.id);
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
      console.error('Failed to check level up:', err);
    }

    return NextResponse.json({
      success: true,
      rewardType,
      xpGained,
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
    console.error('Scout results API error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    return NextResponse.json(
      { 
        error: err.message || 'Failed to process scout results',
        details: err.message 
      },
      { status: 500 }
    );
  }
}
