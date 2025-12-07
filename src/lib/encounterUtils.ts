import { Pool, RowDataPacket } from 'mysql2/promise';

// Encounter reward types
export type EncounterRewardType = 'nothing' | 'discovery' | 'encounter' | 'contact' | 'item';

// Sentiment multipliers for credit costs
export const SENTIMENT_CREDIT_MULTIPLIERS = {
  friendly: 2,
  neutral: 1,
  hostile: 2,
  attack: 3
} as const;

export const BASE_CREDIT_COST = 100;
export const DEFAULT_NEURAL_THERMAL_INCREASE = 10;

/**
 * Roll for encounter reward type based on percentages
 * Current distribution (with Contact/Item at 0%):
 * - 35.7% Nothing (just base XP)
 * - 28.6% Discovery (new zone/POI)
 * - 35.7% Encounter
 */
export function rollEncounterReward(): EncounterRewardType {
  const roll = Math.random() * 100;
  
  // Redistributed percentages (Contact and Item at 0% for now)
  if (roll < 35.7) return 'nothing';
  if (roll < 64.3) return 'discovery'; // 35.7 + 28.6
  return 'encounter'; // remaining 35.7%
}

/**
 * Get weighted random encounter for a zone
 */
export async function getRandomEncounter(
  pool: Pool,
  zoneId: number,
  context: 'city' | 'grid',
  userStreetCred: number
): Promise<any | null> {
  // First try zone-specific weighted encounters
  const [weightedRows] = await pool.query<RowDataPacket[]>(
    `SELECT e.*, ezw.weight 
     FROM encounters e
     JOIN encounter_zone_weights ezw ON e.id = ezw.encounter_id
     WHERE ezw.zone_id = ? 
       AND e.context IN (?, 'both')
       AND e.min_street_cred <= ?
     ORDER BY RAND()
     LIMIT 1`,
    [zoneId, context, userStreetCred]
  );

  if (weightedRows.length > 0) {
    return weightedRows[0];
  }

  // Fallback to any encounter for this zone without weights
  const [fallbackRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM encounters 
     WHERE zone_id = ? 
       AND context IN (?, 'both')
       AND min_street_cred <= ?
     ORDER BY RAND()
     LIMIT 1`,
    [zoneId, context, userStreetCred]
  );

  return fallbackRows.length > 0 ? fallbackRows[0] : null;
}

/**
 * Calculate success rate for an encounter action
 * Base: 50%
 * Modified by: (User Stat - Difficulty) * 2%
 * Clamped: 10% - 95%
 */
export function calculateSuccessRate(
  userStatValue: number,
  difficultyValue: number,
  reputationBonus: number = 0,
  slimsoftBonus: number = 0
): number {
  const baseRate = 50;
  const statDifferential = (userStatValue - difficultyValue) * 2;
  const totalRate = baseRate + statDifferential + reputationBonus + slimsoftBonus;
  
  // Clamp between 10% and 95%
  return Math.max(10, Math.min(95, totalRate));
}

/**
 * Calculate stat value for action requirement
 * Handles composite stats like "cog + insight" or "power + agility + (insight / 2)"
 */
export function calculateActionStatValue(
  actionType: string,
  userStats: {
    cognition: number;
    insight: number;
    interface: number;
    power: number;
    resilience: number;
    agility: number;
  }
): number {
  switch (actionType.toLowerCase()) {
    case 'talk_down':
      return userStats.cognition + userStats.insight;
    
    case 'intimidate':
      return userStats.cognition + userStats.insight + Math.floor(userStats.power / 2);
    
    case 'pay_off':
      return userStats.cognition + userStats.insight;
    
    case 'fight_off':
      return userStats.power + userStats.agility + Math.floor(userStats.insight / 2);
    
    case 'breach':
      return userStats.cognition + userStats.interface;
    
    case 'transact':
      return userStats.cognition + userStats.interface;
    
    case 'hack_slash':
      return userStats.interface + userStats.power;
    
    case 'overload':
      return userStats.interface + userStats.cognition;
    
    case 'data_mine':
      return userStats.cognition + userStats.interface;
    
    default:
      return userStats.cognition; // fallback
  }
}

/**
 * Calculate credit cost for an action based on sentiment
 */
export function calculateCreditCost(
  actionType: string,
  sentiment: string
): number {
  const needsCredits = ['pay_off', 'transact'].includes(actionType.toLowerCase());
  if (!needsCredits) return 0;
  
  const multiplier = SENTIMENT_CREDIT_MULTIPLIERS[sentiment.toLowerCase() as keyof typeof SENTIMENT_CREDIT_MULTIPLIERS] || 1;
  return BASE_CREDIT_COST * multiplier;
}

/**
 * Get sentiment color for UI display
 */
export function getSentimentColor(sentiment: string): string {
  switch (sentiment.toLowerCase()) {
    case 'attack':
      return '#f81216';
    case 'hostile':
      return '#cf5747';
    case 'neutral':
      return '#7a8894';
    case 'friendly':
      return '#4a9eff';
    default:
      return '#ffffff';
  }
}

/**
 * Apply resource costs for an action
 * Returns object with stat changes to apply
 */
export function calculateResourceCosts(
  actionType: string,
  costAmount: number
): {
  consciousness?: number;
  stamina?: number;
  charge?: number;
  neural?: number;
  thermal?: number;
} {
  const costs: any = {};
  
  // Categorize actions by energy type
  const mentalActions = ['talk_down', 'intimidate', 'pay_off', 'transact'];
  const physicalActions = ['fight_off'];
  const techActions = ['breach', 'hack_slash', 'overload', 'data_mine'];
  
  const type = actionType.toLowerCase();
  
  if (mentalActions.includes(type)) {
    // Mental energy: consciousness and neural load
    costs.consciousness = -Math.floor(costAmount * 0.7);
    costs.neural = DEFAULT_NEURAL_THERMAL_INCREASE;
  } else if (physicalActions.includes(type)) {
    // Physical energy: consciousness and stamina
    costs.consciousness = -Math.floor(costAmount * 0.5);
    costs.stamina = -Math.floor(costAmount * 0.5);
  } else if (techActions.includes(type)) {
    // Tech energy: charge and thermal load
    costs.charge = -costAmount;
    costs.thermal = DEFAULT_NEURAL_THERMAL_INCREASE;
  }
  
  return costs;
}
