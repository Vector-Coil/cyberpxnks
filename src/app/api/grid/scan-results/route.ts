import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { StatsService } from '../../../../lib/statsService';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';

interface DiscoveredSubnet {
  name: string;
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    
    const body = await request.json();
    const { historyId } = body;

    // Get user ID
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Get user's street cred for encounter filtering
    const [userDataRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userStreetCred = userDataRows[0]?.street_cred || 0;

    // Award base XP for completing scan
    const xpGained = 50;
    await dbPool.query(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [xpGained, userId]
    );

    // Roll for reward type
    const rewardType = rollEncounterReward();
    
    const discoveredSubnet: DiscoveredSubnet | null = null;
    let encounter = null;

    if (rewardType === 'discovery') {
      // TODO: Add subnet/protocol discovery logic here when ready
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

    // Build gains text
    let gainsText = `+${xpGained} XP`;
    if (discoveredSubnet) {
      gainsText += `, Discovered ${discoveredSubnet.name}`;
    } else if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

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

    // Get updated stats
    const [updatedStatsRows] = await dbPool.query<RowDataPacket[]>(
      `SELECT current_charge, current_bandwidth, current_neural, current_thermal
       FROM user_stats 
       WHERE user_id = ?`,
      [userId]
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
      console.error('Failed to check level up:', err);
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
      updatedStats: updatedStatsRows[0],
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (error: any) {
    console.error('Error processing Overnet Scan results:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json({ 
      error: 'Failed to process Overnet Scan results',
      details: error.message 
    }, { status: 500 });
  }
}
