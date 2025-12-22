import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { RowDataPacket } from 'mysql2/promise';
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
    const { historyId, poiId } = body;

    logger.debug('Breach results request', { fid, historyId, poiId });

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Verify this is the user's breach and it's complete
    const [breachRows] = await pool.execute<any[]>(
      `SELECT id, zone_id, end_time, result_status FROM user_zone_history 
       WHERE id = ? AND user_id = ? AND action_type = 'Breached'
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
         WHERE user_id = ? AND action_type = 'Breached' ORDER BY timestamp DESC LIMIT 3`,
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

    // Award random XP (30-50 in increments of 5)
    // Note: Thermal/neural load increases are handled automatically by the regeneration system during breach
    const xpOptions = [30, 35, 40, 45, 50];
    const baseXp = xpOptions[Math.floor(Math.random() * xpOptions.length)];
    
    // TODO: Add +10 XP bonus on data/item discovery (when discovery system implemented)
    const discoveryBonus = 0;

    // Get user's street cred for encounter filtering
    const [userDataRows] = await pool.execute<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    // Roll for reward type (encounter chance on breach)
    const rewardType = rollEncounterReward();
    
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

    // Restore bandwidth (increment by 1, will be capped by validation elsewhere)
    await pool.execute(
      'UPDATE user_stats SET current_bandwidth = current_bandwidth + 1 WHERE user_id = ?',
      [userId]
    );

    // Apply total XP (base + discovery bonus)
    const totalXp = baseXp + discoveryBonus;
    await pool.execute(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [totalXp, userId]
    );

    // Build gains text
    let gainsText = `+${totalXp} XP`;
    if (discoveryBonus > 0) {
      gainsText += ' (+10 discovery bonus)';
    }
    if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    // Mark breach as complete with gains_data for display
    await pool.execute(
      `UPDATE user_zone_history 
       SET result_status = 'completed', xp_data = ?, gains_data = ?
       WHERE id = ?`,
      [totalXp, gainsText, historyId]
    );

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
    await logActivity(
      userId,
      'action',
      'breach_completed',
      totalXp,
      poiId || null,
      `Completed breach of ${poiName}, gained ${totalXp} XP`
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

    return NextResponse.json({
      success: true,
      historyId: historyId,
      xpGained: totalXp,
      rewardType,
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
