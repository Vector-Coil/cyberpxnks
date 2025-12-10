import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { RowDataPacket } from 'mysql2/promise';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    const { historyId, poiId } = body;

    console.log('Breach results request:', { fid, historyId, poiId });

    if (!historyId) {
      return NextResponse.json({ error: 'Missing historyId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify this is the user's breach and it's complete
    const [breachRows] = await pool.execute<any[]>(
      `SELECT id, zone_id, end_time, result_status FROM user_zone_history 
       WHERE id = ? AND user_id = ? AND action_type = 'Breached'
       LIMIT 1`,
      [historyId, user.id]
    );

    console.log('Breach query result:', { 
      breachRows, 
      historyId, 
      userId: user.id,
      foundRows: breachRows.length,
      breach: breachRows[0] 
    });

    if (breachRows.length === 0) {
      // Try to find ANY breach for this user to help debug
      const [debugRows] = await pool.execute<any[]>(
        `SELECT id, action_type, result_status, poi_id FROM user_zone_history 
         WHERE user_id = ? AND action_type = 'Breached' ORDER BY timestamp DESC LIMIT 3`,
        [user.id]
      );
      console.log('Debug: Recent breaches for user:', debugRows);
      return NextResponse.json({ error: 'Breach not found or already completed', debug: { searched: historyId, found: debugRows } }, { status: 404 });
    }

    const breach = breachRows[0];
    
    if (breach.result_status && breach.result_status !== '') {
      console.log('Breach already completed:', breach.result_status);
      return NextResponse.json({ error: 'Breach already completed' }, { status: 400 });
    }

    // Check if breach is complete
    const now = new Date();
    const endTime = new Date(breach.end_time);
    if (now < endTime) {
      return NextResponse.json({ error: 'Breach not yet complete' }, { status: 400 });
    }

    // Award random XP (50-75 in increments of 5)
    // Note: Thermal/neural load increases are handled automatically by the regeneration system during breach
    const xpOptions = [50, 55, 60, 65, 70, 75];
    const xpGained = xpOptions[Math.floor(Math.random() * xpOptions.length)];

    // Update user XP
    await pool.execute(
      'UPDATE users SET xp = xp + ? WHERE id = ?',
      [xpGained, user.id]
    );

    // Get user's street cred for encounter filtering
    const [userDataRows] = await pool.execute<RowDataPacket[]>(
      'SELECT street_cred FROM users WHERE id = ? LIMIT 1',
      [user.id]
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
          user.id,
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
      [user.id]
    );

    // Build gains text
    let gainsText = `+${xpGained} XP`;
    if (encounter) {
      gainsText += `, Encountered ${encounter.name}`;
    }

    // Mark breach as complete with gains_data for display
    await pool.execute(
      `UPDATE user_zone_history 
       SET result_status = 'completed', xp_data = ?, gains_data = ?
       WHERE id = ?`,
      [xpGained, gainsText, historyId]
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
      user.id,
      'action',
      'breach_completed',
      xpGained,
      poiId || null,
      `Completed breach of ${poiName}, gained ${xpGained} XP`
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

    // Get updated stats
    const [updatedStatsRows] = await pool.execute<any[]>(
      'SELECT * FROM user_stats WHERE user_id = ? LIMIT 1',
      [user.id]
    );

    return NextResponse.json({
      success: true,
      xpGained,
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
    console.error('Breach results API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to complete breach' },
      { status: 500 }
    );
  }
}
