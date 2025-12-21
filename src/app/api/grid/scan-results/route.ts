import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { validateFid, requireParams } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

interface DiscoveredSubnet {
  name: string;
}

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

    // Award base XP for completing scan (random 10-30)
    const baseXpOptions = [10, 15, 20, 25, 30];
    const baseXp = baseXpOptions[Math.floor(Math.random() * baseXpOptions.length)];

    // Roll for reward type
    const rewardType = rollEncounterReward();
    
    let discoveredSubnet: DiscoveredSubnet | null = null;
    let encounter: any = null;
    let discoveryBonus = 0;

    if (rewardType === 'discovery') {
      // TODO: Add subnet/protocol discovery logic here when ready
      // When implemented: discoveryBonus = 10;
    } else if (rewardType === 'encounter') {
      // Get random encounter for grid context (zone_id = 2 for generic grid encounters)
      encounter = await getRandomEncounter(dbPool, 2, 'grid', userStreetCred);
      
      if (encounter) {
        // Log encounter trigger
        await logActivity(
          userId,
          'encounter',
          'triggered',
          null,
          encounter.id,
          `Encountered ${encounter.name} during grid scan`
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
    if (discoveryBonus > 0) {
      gainsText += ' (+10 discovery bonus)';
    }
    if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }
    // TODO: Add subnet discovery text when discovery logic is implemented
    // if (discoveredSubnet !== null) {
    //   gainsText += `, Discovered ${discoveredSubnet.name}`;
    // }

    // Update history record
    await dbPool.query(
      `UPDATE user_zone_history 
       SET result_status = 'completed', 
           xp_data = ?, 
           gains_data = ? 
       WHERE id = ?`,
      [xpGained, gainsText, historyId]
    );

    // Restore bandwidth and reset loads using StatsService
    const statsService = new StatsService(dbPool, userId);
    await statsService.modifyStats({
      bandwidth: 1,  // +1 to restore
      neural: -999,  // Large negative to reset to 0 (will be capped at 0)
      thermal: -999  // Large negative to reset to 0 (will be capped at 0)
    });

    // Log scan completion activity
    await logActivity(
      userId,
      'action',
      'overnet_scan_completed',
      xpGained,
      null,
      `Completed Overnet Scan, gained ${xpGained} XP`
    );

    // Get updated stats using StatsService to get both current and max values
    const updatedStatsService = new StatsService(dbPool, userId);
    const updatedStats = await updatedStatsService.getStats();

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
      xpGained,
      gainsText,
      discoveredSubnet,
      encounter: encounter ? {
        id: encounter.id,
        name: encounter.name,
        type: encounter.encounter_type,
        sentiment: encounter.default_sentiment,
        imageUrl: encounter.image_url
      } : null,
      updatedStats: {
        current_charge: updatedStats.current.charge,
        current_bandwidth: updatedStats.current.bandwidth,
        current_neural: updatedStats.current.neural,
        current_thermal: updatedStats.current.thermal,
        max_charge: updatedStats.max.charge,
        max_bandwidth: updatedStats.max.bandwidth,
        max_neural: updatedStats.max.neural,
        max_thermal: updatedStats.max.thermal
      },
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (error: any) {
    logger.error('Scan results error', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return handleApiError(error, 'Failed to process Overnet Scan results');
  }
}
