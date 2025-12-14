import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../../lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { calculateActionStatValue, calculateSuccessRate, calculateCreditCost, calculateResourceCosts } from '../../../../../lib/encounterUtils';
import { StatsService } from '../../../../../lib/statsService';
import { requireParams, handleApiError } from '../../../../../lib/api/errors';
import { logger } from '../../../../../lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const encounterId = parseInt(id, 10);
    
    if (isNaN(encounterId)) {
      return NextResponse.json({ error: 'Invalid encounter ID' }, { status: 400 });
    }

    const body = await request.json();
    requireParams(body, ['fid', 'actionId']);
    const { fid, actionId } = body;

    const pool = await getDbPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get user data with lock
      const [userRows] = await connection.query<RowDataPacket[]>(
        `SELECT id, cognition, insight, interface, power, resilience, agility, 
                street_cred, credits, level
         FROM users WHERE fid = ? FOR UPDATE`,
        [fid]
      );

      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userRows[0];

      // Get encounter details
      const [encounterRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM encounters WHERE id = ? LIMIT 1`,
        [encounterId]
      );

      if (encounterRows.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
      }

      const encounter = encounterRows[0];

      // Get action details
      const [actionRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM encounter_actions WHERE id = ? LIMIT 1`,
        [actionId]
      );

      if (actionRows.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'Action not found' }, { status: 404 });
      }

      const action = actionRows[0];

      // Calculate user stat value for this action
      const userStatValue = calculateActionStatValue(action.name, {
        cognition: user.cognition,
        insight: user.insight,
        interface: user.interface,
        power: user.power,
        resilience: user.resilience,
        agility: user.agility
      });

      // Calculate success rate
      const successRate = calculateSuccessRate(userStatValue, action.difficulty_value);

      // Roll for success
      const roll = Math.random() * 100;
      const success = roll <= successRate;

      // Calculate costs and rewards
      const creditCost = calculateCreditCost(action.name, encounter.default_sentiment);
      const resourceCosts = calculateResourceCosts(action.name, action.cost_amount || 10);

      // Check if user can afford credit cost
      if (creditCost > 0 && user.credits < creditCost) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
      }

      // Determine rewards/penalties
      const xpGained = success ? action.success_xp : action.failure_xp;
      const repChange = success ? action.success_rep_mod : action.failure_rep_mod;
      
      // Street cred calculation: bonus for matching sentiment, penalty for mismatch
      let streetCredChange = 0;
      const actionSentiment = action.sentiment.toLowerCase();
      const encounterSentiment = encounter.default_sentiment.toLowerCase();
      
      if (success) {
        if (actionSentiment === 'attack' && encounterSentiment === 'friendly') {
          streetCredChange = -10; // Attacking friendly NPCs is bad
        } else if (actionSentiment === 'friendly' && encounterSentiment === 'attack') {
          streetCredChange = 15; // De-escalating attacks is heroic
        } else if (actionSentiment === encounterSentiment) {
          streetCredChange = 5; // Matching approach
        } else {
          streetCredChange = 2; // Successful but mismatched
        }
      } else {
        streetCredChange = -3; // Failed actions reduce street cred
      }

      // Calculate credit rewards for combat actions
      let creditReward = 0;
      if (success && (action.name.toLowerCase().includes('fight') || action.name.toLowerCase().includes('hack_slash'))) {
        creditReward = Math.floor(50 * (1 + (user.level / 10))); // Scales with level
      }

      // Calculate credit losses on failure for combat actions
      let creditLoss = 0;
      if (!success && (action.name.toLowerCase().includes('fight') || action.name.toLowerCase().includes('hack_slash'))) {
        creditLoss = Math.floor(100 * (1 + (user.level / 10)));
      }

      // Apply changes to user
      const updates: string[] = [];
      const values: any[] = [];

      // XP
      if (xpGained > 0) {
        updates.push('xp = xp + ?');
        values.push(xpGained);
      }

      // Street Cred
      updates.push('street_cred = street_cred + ?');
      values.push(streetCredChange);

      // Credits
      const totalCreditChange = -creditCost + creditReward - creditLoss;
      if (totalCreditChange !== 0) {
        updates.push('credits = credits + ?');
        values.push(totalCreditChange);
      }

      // Update users table
      if (updates.length > 0) {
        values.push(user.id);
        await connection.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Apply resource costs to user_stats
      const statsService = new StatsService(connection as any, user.id);
      if (Object.keys(resourceCosts).length > 0) {
        await statsService.modifyStats(resourceCosts);
      }

      // Record encounter in history
      await connection.query(
        `INSERT INTO user_encounter_history 
         (user_id, encounter_id, action_id, success, xp_gained, street_cred_change, 
          rep_change, credits_change, zone_id, context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          encounterId,
          actionId,
          success,
          xpGained,
          streetCredChange,
          repChange,
          totalCreditChange,
          encounter.zone_id,
          encounter.context || 'city'
        ]
      );

      // Log to activity ledger
      await logActivity(
        user.id,
        'encounter',
        success ? 'success' : 'failure',
        xpGained,
        encounterId,
        `Encounter: ${encounter.name} - Action: ${action.name} - ${success ? 'Success' : 'Failure'}`
      );

      await connection.commit();
      connection.release();

      // Return results
      return NextResponse.json({
        success,
        successRate,
        roll: Math.floor(roll),
        results: {
          xp: xpGained,
          streetCred: streetCredChange,
          reputation: repChange,
          credits: totalCreditChange,
          description: success ? action.success_desc : action.failure_desc
        },
        resourceCosts,
        encounter: {
          name: encounter.name,
          type: encounter.encounter_type,
          sentiment: encounter.default_sentiment
        },
        action: {
          name: action.name,
          sentiment: action.sentiment
        }
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err: any) {
    return handleApiError(err, 'Failed to execute encounter action');
  }
}
