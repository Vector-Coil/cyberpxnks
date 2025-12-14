import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { calculateActionStatValue, calculateSuccessRate, calculateCreditCost, getSentimentColor } from '../../../../lib/encounterUtils';
import { validateFid, handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const encounterId = parseInt(id, 10);
    
    if (isNaN(encounterId)) {
      return NextResponse.json({ error: 'Invalid encounter ID' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');
    validateFid(fid);

    const pool = await getDbPool();

    // Get user data
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, cognition, insight, interface, power, resilience, agility, street_cred, credits
       FROM users WHERE fid = ? LIMIT 1`,
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userRows[0];

    // Get encounter details
    const [encounterRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM encounters WHERE id = ? LIMIT 1`,
      [encounterId]
    );

    if (encounterRows.length === 0) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
    }

    const encounter = encounterRows[0];

    // Get available actions for this encounter
    const [actionRows] = await pool.query<RowDataPacket[]>(
      `SELECT ea.*, eaa.required_item_id, eaa.must_be_equipped, 
              eaa.required_contact_id, eaa.required_gig_id
       FROM encounter_actions ea
       JOIN encounter_action_availability eaa ON ea.id = eaa.action_id
       WHERE eaa.encounter_id = ?`,
      [encounterId]
    );

    // Calculate success rates and costs for each action
    const availableActions = await Promise.all(
      actionRows.map(async (action) => {
        // Check requirements
        let meetsRequirements = true;
        let requirementText = '';

        // Check item requirements
        if (action.required_item_id) {
          const [itemRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as has_item FROM user_inventory 
             WHERE user_id = ? AND item_id = ? ${action.must_be_equipped ? 'AND equipped = 1' : ''}`,
            [user.id, action.required_item_id]
          );
          meetsRequirements = meetsRequirements && itemRows[0].has_item > 0;
        }

        // Check contact requirements
        if (action.required_contact_id) {
          const [contactRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as has_contact FROM contact_history 
             WHERE user_id = ? AND contact_id = ? AND unlocked = 1`,
            [user.id, action.required_contact_id]
          );
          meetsRequirements = meetsRequirements && contactRows[0].has_contact > 0;
        }

        // Check gig requirements
        if (action.required_gig_id) {
          const [gigRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as has_gig FROM gig_history 
             WHERE user_id = ? AND gig_id = ? AND status IN ('UNLOCKED', 'IN_PROGRESS', 'COMPLETED')`,
            [user.id, action.required_gig_id]
          );
          meetsRequirements = meetsRequirements && gigRows[0].has_gig > 0;
        }

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

        // Calculate costs
        const creditCost = calculateCreditCost(action.name, encounter.default_sentiment);
        const statCost = action.cost_amount || 0;

        // Check if user can afford
        const canAfford = creditCost > 0 ? user.credits >= creditCost : true;

        // Build requirement text
        if (creditCost > 0) {
          requirementText = `-${creditCost} $CX`;
        } else if (action.requires_stat && statCost > 0) {
          requirementText = `REQ: ${statCost} ${action.requires_stat.toUpperCase()}`;
        }

        return {
          id: action.id,
          name: action.name,
          sentiment: action.sentiment,
          sentimentColor: getSentimentColor(action.sentiment),
          successRate,
          requirementText,
          creditCost,
          statCost,
          costStat: action.cost_stat,
          successRewards: {
            rep: action.success_rep_mod,
            streetCred: 0, // Will calculate based on action vs encounter sentiment mismatch
            xp: action.success_xp,
            credits: 0 // For fight_off/hack_slash on success
          },
          failureConsequences: {
            rep: action.failure_rep_mod,
            streetCred: 0,
            xp: action.failure_xp,
            credits: 0
          },
          successDesc: action.success_desc,
          failureDesc: action.failure_desc,
          meetsRequirements,
          canAfford
        };
      })
    );

    return NextResponse.json({
      encounter: {
        id: encounter.id,
        name: encounter.name,
        imageUrl: encounter.image_url,
        type: encounter.encounter_type,
        sentiment: encounter.default_sentiment,
        sentimentColor: getSentimentColor(encounter.default_sentiment),
        dialogue: encounter.initial_dialogue || `[${encounter.default_sentiment.toUpperCase()} NPC has no dialogue]`,
        zoneId: encounter.zone_id
      },
      actions: availableActions,
      userStats: {
        streetCred: user.street_cred,
        credits: user.credits
      }
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch encounter details');
  }
}
