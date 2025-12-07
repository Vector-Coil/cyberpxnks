import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { rollEncounterReward, getRandomEncounter } from '../../../../lib/encounterUtils';
import { StatsService } from '../../../../lib/statsService';

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

    // Award base XP
    await dbPool.query(
      'UPDATE users SET xp = xp + 75 WHERE id = ?',
      [userId]
    );

    // Roll for reward type (35.7% nothing, 28.6% discovery, 35.7% encounter)
    const rewardType = rollEncounterReward();
    console.log('[EXPLORE-RESULTS] Rolled reward type:', rewardType);
    
    let discoveredZone = null;
    let encounter = null;

    if (rewardType === 'discovery') {
      // Get undiscovered zones from active districts
      const [undiscoveredZonesRows] = await dbPool.query<RowDataPacket[]>(
        `SELECT z.id, z.name, z.zone_type, z.district, z.description, z.image_url 
         FROM zones z
         INNER JOIN zone_districts zd ON z.district = zd.id
         WHERE zd.active = true
           AND z.id NOT IN (
             SELECT DISTINCT zone_id 
             FROM user_zone_history 
             WHERE user_id = ? AND zone_id IS NOT NULL
           )
         ORDER BY RAND()
         LIMIT 1`,
        [userId]
      );

      if (undiscoveredZonesRows.length > 0) {
        discoveredZone = undiscoveredZonesRows[0];

        // Update history with discovered zone ID
        await dbPool.query(
          'UPDATE user_zone_history SET discovered = ? WHERE id = ?',
          [discoveredZone.id, historyId]
        );

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
          `Discovered ${discoveredZone.name}`
        );
      }
    } else if (rewardType === 'encounter') {
      // Get random encounter for city context (zone_id = 1 for generic city encounters)
      encounter = await getRandomEncounter(dbPool, 1, 'city', userStreetCred);
      console.log('[EXPLORE-RESULTS] Encounter found:', encounter ? encounter.name : 'null (no encounters in database)');
      
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

    // Build gains text
    let gainsText = '+75 XP';
    if (discoveredZone) {
      gainsText += `, Discovered ${discoveredZone.name}`;
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
      console.error('Failed to check level up:', err);
    }

    return NextResponse.json({
      success: true,
      xpGained: 75,
      rewardType,
      discoveredZone,
      encounter: encounter ? {
        id: encounter.id,
        name: encounter.name,
        type: encounter.encounter_type,
        sentiment: encounter.default_sentiment,
        imageUrl: encounter.image_url
      } : null,
      levelUp: levelUpData?.leveledUp ? levelUpData : null
    });
  } catch (error: any) {
    console.error('Error processing explore results:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json({ 
      error: 'Failed to process explore results',
      details: error.message 
    }, { status: 500 });
  }
}
