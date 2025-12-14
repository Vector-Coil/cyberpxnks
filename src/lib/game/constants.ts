/**
 * Game constants and configuration values.
 * 
 * Centralizes all game balance parameters, costs, cooldowns, and configuration.
 * This makes it easy to tune game balance without searching through code.
 * 
 * Usage:
 *   import { ACTION_COSTS, COOLDOWNS, LIMITS } from '~/lib/game/constants';
 * 
 *   validator.requireResources(ACTION_COSTS.ZONE_SCOUT);
 */

import { ResourceCost } from './resourceValidator';

/**
 * Resource costs for various game actions
 */
export const ACTION_COSTS = {
  // Zone actions
  ZONE_SCOUT: {
    stamina: 20,
    bandwidth: 1,
    minConsciousnessPercent: 0.5 // 50% of max consciousness
  } as ResourceCost,

  ZONE_BREACH_PHYSICAL: {
    charge: 15,
    stamina: 15,
    bandwidth: 1
  } as ResourceCost,

  ZONE_BREACH_REMOTE: {
    charge: 10,
    bandwidth: 1
  } as ResourceCost,

  // City actions
  CITY_EXPLORE: {
    stamina: 25,
    bandwidth: 1,
    minConsciousnessPercent: 0.5
  } as ResourceCost,

  // Grid actions
  GRID_SCAN: {
    charge: 10,
    bandwidth: 1,
    thermal: 5,
    neural: 5
  } as ResourceCost,

  // Travel
  ZONE_TRAVEL: {
    stamina: 10,
    charge: 5
  } as ResourceCost
};

/**
 * Cooldown durations in milliseconds
 * NOTE: Set to 1 minute for testing purposes
 */
export const COOLDOWNS = {
  ZONE_SCOUT: 60 * 1000, // 1 minute (testing)
  ZONE_BREACH: 60 * 1000, // 1 minute (testing)
  CITY_EXPLORE: 60 * 1000, // 1 minute (testing)
  GRID_SCAN: 60 * 1000, // 1 minute (testing)
  REGENERATION_TICK: 5 * 60 * 1000 // 5 minutes
};

/**
 * Game limits and thresholds
 */
export const LIMITS = {
  // Maximum concurrent actions is determined by user's bandwidth stat
  // (this is just for reference)
  DEFAULT_MAX_BANDWIDTH: 3,

  // Inventory limits
  MAX_HARDWARE_SLOTS: 10,
  MAX_SLIMSOFT_SLOTS: 5,

  // Level progression
  MIN_LEVEL: 1,
  MAX_LEVEL: 100,
  
  // XP calculation
  XP_BASE_PER_LEVEL: 100,
  XP_GROWTH_MULTIPLIER: 1.5,

  // Currency limits (for display/validation)
  MAX_CREDITS: 999999999,
  MAX_STREET_CRED: 999999
};

/**
 * Regeneration rates (per tick)
 */
export const REGENERATION_RATES = {
  CONSCIOUSNESS: 5, // Base regeneration per tick
  STAMINA: 5,
  CHARGE: 3,
  THERMAL_DECAY: -10, // Negative = reduces thermal load
  NEURAL_DECAY: -10 // Negative = reduces neural load
};

/**
 * Combat and encounter constants
 */
export const COMBAT = {
  BASE_DAMAGE: 10,
  BASE_DEFENSE: 5,
  CRIT_CHANCE: 0.15, // 15%
  CRIT_MULTIPLIER: 2.0,
  FLEE_SUCCESS_RATE: 0.7 // 70%
};

/**
 * Reward multipliers
 */
export const REWARDS = {
  XP_MULTIPLIER_BASE: 1.0,
  CREDITS_MULTIPLIER_BASE: 1.0,
  
  // Bonus for different action types
  BREACH_XP_BONUS: 1.5,
  SCOUT_XP_BONUS: 1.2,
  ENCOUNTER_XP_BONUS: 2.0,
  
  // Discovery bonuses
  POI_DISCOVERY_CREDITS: 100,
  ZONE_DISCOVERY_CREDITS: 250,
  PROTOCOL_DISCOVERY_CREDITS: 500
};

/**
 * Shop and economy constants
 */
export const ECONOMY = {
  // Starting resources
  STARTING_CREDITS: 1000,
  STARTING_STREET_CRED: 0,
  
  // Transaction fees
  SHOP_TAX_RATE: 0, // No tax for now
  
  // Price ranges (for validation)
  MIN_ITEM_PRICE: 1,
  MAX_ITEM_PRICE: 1000000
};

/**
 * Difficulty scaling
 */
export const DIFFICULTY = {
  // Breach difficulty levels
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5,
  EXTREME: 6,
  
  // Success rate calculations
  BASE_SUCCESS_RATE: 0.5,
  DIFFICULTY_PENALTY_PER_LEVEL: 0.1
};

/**
 * Helper function to calculate XP required for a level
 */
export function getXpForLevel(level: number): number {
  return Math.floor(
    LIMITS.XP_BASE_PER_LEVEL * Math.pow(LIMITS.XP_GROWTH_MULTIPLIER, level - 1)
  );
}

/**
 * Helper function to calculate level from XP
 */
export function getLevelFromXp(xp: number): number {
  let level = 1;
  let xpRequired = 0;
  
  while (xpRequired <= xp && level < LIMITS.MAX_LEVEL) {
    xpRequired += getXpForLevel(level);
    if (xpRequired <= xp) level++;
  }
  
  return level;
}

/**
 * Helper to get action cost by name
 */
export function getActionCost(actionType: keyof typeof ACTION_COSTS): ResourceCost {
  return ACTION_COSTS[actionType];
}

/**
 * Helper to get cooldown duration by name
 */
export function getCooldown(actionType: keyof typeof COOLDOWNS): number {
  return COOLDOWNS[actionType];
}
