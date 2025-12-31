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

  // Base success rate
  let successRate = 60;

  // Add Decryption bonus
  successRate += decryption / 10;

  // Add Interface bonus
  successRate += interfaceStat;

  // Add Cache bonus
  successRate += cache / 20;

  // Subtract level disparity penalty
  const levelDiff = districtLevel - userLevel;
  if (levelDiff > 0) {
    successRate -= levelDiff * 10;
  }

  // Subtract breach difficulty penalty
  if (breachDifficulty > 0) {
    successRate -= breachDifficulty * 5;
  }

  // Apply floor and cap
  successRate = Math.max(15, Math.min(95, successRate));

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
