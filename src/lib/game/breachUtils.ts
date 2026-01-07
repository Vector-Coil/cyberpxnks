/**
 * Utility functions for breach success/failure mechanics
 */

export interface BreachSuccessParams {
  decryption: number;
  interfaceStat: number;
  cache: number;
  userLevel: number;
  districtLevel: number;
  breachDifficulty: number;
  // Optional extra tech/contextual values
  deckTier?: number;
  slimsoftTier?: number;
  clockSpeed?: number;
  latency?: number;
  signalNoise?: number;
  // Optional slimsoft percent modifier (0-100)
  slimsoftPct?: number;
}

export interface BreachSuccessResult {
  successRate: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskColor: string;
}

/**
 * Calculate breach success rate based on user stats and difficulty
 * Formula:
 * - Base: 60%
 * - + (Decryption / 10)%
 * - + Interface%
 * - + (Cache / 20)%
 * - - (Level Disparity × 10)%
 * - - (breach_difficulty × 5)%
 * - Floor: 15%
 * - Cap: 95%
 */
export function calculateBreachSuccessRate(params: BreachSuccessParams): BreachSuccessResult {
  const {
    decryption,
    interfaceStat,
    cache,
    userLevel,
    districtLevel,
    breachDifficulty
  } = params;

  // New formula (separate contributions)
  const {
    deckTier = 0,
    slimsoftTier = 0,
    clockSpeed = 0,
    latency = 0,
    signalNoise = 0
  } = params as any;

  let success = 50; // base

  // Decryption contribution (primary)
  let decryptionContrib = decryption * 0.6;

  // Apply slimsoft percent modifier multiplicatively if provided
  const slimsoftPct = (params as any).slimsoftPct || 0;
  if (slimsoftPct) {
    decryptionContrib = decryptionContrib * (1 + (slimsoftPct / 100));
  }

  // Tier bonuses
  const tierBonus = (deckTier || 0) * 5; // +5% per tier
  const slimsoftTierBonus = (slimsoftTier && slimsoftTier > 0) ? slimsoftTier * 3 : 0;

  // Tech bonuses
  const techBonus = (clockSpeed || 0) * 0.5 + (cache || 0) * 0.3;

  // Signal provides a small bonus: signalNoise / 10
  const signalBonus = (signalNoise || 0) / 10;

  // Latency is a penalty
  const latencyPenalty = (latency || 0) * 0.5;

  // Level and difficulty penalties (softened)
  const levelDiff = Math.max(0, districtLevel - userLevel);
  const levelPenalty = levelDiff * 8;
  const difficultyPenalty = (breachDifficulty || 0) * 4;

  // Interface adds directly
  success += decryptionContrib + tierBonus + slimsoftTierBonus + techBonus + signalBonus - latencyPenalty - levelPenalty - difficultyPenalty + (interfaceStat || 0);

  // Clamp
  success = Math.max(10, Math.min(98, success));
  let successRate = success;

  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  let riskColor: string;

  if (successRate >= 75) {
    riskLevel = 'low';
    riskColor = 'text-green-400';
  } else if (successRate >= 50) {
    riskLevel = 'moderate';
    riskColor = 'text-yellow-400';
  } else if (successRate >= 30) {
    riskLevel = 'high';
    riskColor = 'text-orange-400';
  } else {
    riskLevel = 'critical';
    riskColor = 'text-red-400';
  }

  return {
    successRate: Math.round(successRate),
    riskLevel,
    riskColor
  };
}

/**
 * Determine if a breach succeeds based on success rate
 */
export function rollBreachSuccess(successRate: number): boolean {
  const roll = Math.random() * 100;
  return roll < successRate;
}

/**
 * Determine if a failed breach is a critical failure
 * 15% of failures are critical
 */
export function rollCriticalFailure(): boolean {
  return Math.random() < 0.15;
}

/**
 * Calculate failure penalties
 */
export function getBreachFailurePenalties() {
  return {
    stamina: -10,
    consciousness: -20,
    charge: -15,
    neural: 10,
    thermal: 10
  };
}

/**
 * Calculate reduced XP for failure (25% of base)
 */
export function calculateFailureXP(baseXp: number): number {
  return Math.floor(baseXp * 0.25);
}
