/**
 * Resource validation utilities for game mechanics.
 * 
 * Provides consistent validation of resource costs (stamina, charge, bandwidth, etc.)
 * across all game actions. Helps ensure game balance and provides clear error messages.
 * 
 * Usage:
 *   import { ResourceValidator } from '~/lib/game/resourceValidator';
 * 
 *   const validator = new ResourceValidator(userStats);
 *   validator.requireStamina(15);
 *   validator.requireCharge(10);
 *   validator.requireBandwidth(1);
 *   validator.validate(); // Throws ApiError if any requirements not met
 */

import { ApiErrors } from '../api/errors';

export interface CurrentStats {
  // Support both formats for backward compatibility
  current_consciousness?: number;
  current_stamina?: number;
  current_charge?: number;
  current_bandwidth?: number;
  current_thermal?: number;
  current_neural?: number;
  // StatsService format (without prefix)
  consciousness?: number;
  stamina?: number;
  charge?: number;
  bandwidth?: number;
  thermal?: number;
  neural?: number;
}

export interface MaxStats {
  // Support both formats for backward compatibility
  max_consciousness?: number;
  max_stamina?: number;
  max_charge?: number;
  max_bandwidth?: number;
  max_thermal?: number;
  max_neural?: number;
  // StatsService format (without prefix)
  consciousness?: number;
  stamina?: number;
  charge?: number;
  bandwidth?: number;
  thermal?: number;
  neural?: number;
}

export interface ResourceCost {
  stamina?: number;
  charge?: number;
  bandwidth?: number;
  consciousness?: number;
  thermal?: number;
  neural?: number;
  minConsciousnessPercent?: number; // e.g., 0.5 for 50%
}

interface ValidationError {
  resource: string;
  required: number;
  available: number;
}

/**
 * Validates resource requirements for game actions
 */
export class ResourceValidator {
  private errors: ValidationError[] = [];

  constructor(
    private currentStats: CurrentStats,
    private maxStats?: MaxStats
  ) {}

  // Helper methods to support both property formats
  private getCurrentValue(stat: keyof Omit<CurrentStats, 'current_consciousness' | 'current_stamina' | 'current_charge' | 'current_bandwidth' | 'current_thermal' | 'current_neural'>): number {
    const prefixed = `current_${stat}` as keyof CurrentStats;
    return (this.currentStats[prefixed] as number) ?? (this.currentStats[stat] as number) ?? 0;
  }

  private getMaxValue(stat: string): number {
    if (!this.maxStats) return 0;
    const prefixed = `max_${stat}` as keyof MaxStats;
    return (this.maxStats[prefixed] as number) ?? (this.maxStats[stat as keyof MaxStats] as number) ?? 0;
  }

  /**
   * Require minimum stamina
   */
  requireStamina(amount: number): this {
    const available = this.getCurrentValue('stamina');
    if (available < amount) {
      this.errors.push({
        resource: 'stamina',
        required: amount,
        available
      });
    }
    return this;
  }

  /**
   * Require minimum charge
   */
  requireCharge(amount: number): this {
    const available = this.getCurrentValue('charge');
    if (available < amount) {
      this.errors.push({
        resource: 'charge',
        required: amount,
        available
      });
    }
    return this;
  }

  /**
   * Require minimum bandwidth
   */
  requireBandwidth(amount: number): this {
    const available = this.getCurrentValue('bandwidth');
    if (available < amount) {
      this.errors.push({
        resource: 'bandwidth',
        required: amount,
        available
      });
    }
    return this;
  }

  /**
   * Require minimum consciousness
   */
  requireConsciousness(amount: number): this {
    const available = this.getCurrentValue('consciousness');
    if (available < amount) {
      this.errors.push({
        resource: 'consciousness',
        required: amount,
        available
      });
    }
    return this;
  }

  /**
   * Require consciousness to be at least X% of maximum
   */
  requireConsciousnessPercent(percent: number): this {
    if (!this.maxStats) {
      throw new Error('Max stats required for percentage validation');
    }

    const maxConsciousness = this.getMaxValue('consciousness');
    const available = this.getCurrentValue('consciousness');
    const required = Math.floor(maxConsciousness * percent);
    if (available < required) {
      this.errors.push({
        resource: 'consciousness',
        required,
        available
      });
    }
    return this;
  }

  /**
   * Require thermal capacity (ensure thermal is below max)
   */
  requireThermalCapacity(amount: number): this {
    if (!this.maxStats) {
      throw new Error('Max stats required for thermal validation');
    }

    const maxThermal = this.getMaxValue('thermal');
    const currentThermal = this.getCurrentValue('thermal');
    const availableCapacity = maxThermal - currentThermal;
    if (availableCapacity < amount) {
      this.errors.push({
        resource: 'thermal capacity',
        required: amount,
        available: availableCapacity
      });
    }
    return this;
  }

  /**
   * Require neural capacity (ensure neural is below max)
   */
  requireNeuralCapacity(amount: number): this {
    if (!this.maxStats) {
      throw new Error('Max stats required for neural validation');
    }

    const maxNeural = this.getMaxValue('neural');
    const currentNeural = this.getCurrentValue('neural');
    const availableCapacity = maxNeural - currentNeural;
    if (availableCapacity < amount) {
      this.errors.push({
        resource: 'neural capacity',
        required: amount,
        available: availableCapacity
      });
    }
    return this;
  }

  /**
   * Validate multiple resources at once
   */
  requireResources(costs: ResourceCost): this {
    if (costs.stamina !== undefined) {
      this.requireStamina(costs.stamina);
    }
    if (costs.charge !== undefined) {
      this.requireCharge(costs.charge);
    }
    if (costs.bandwidth !== undefined) {
      this.requireBandwidth(costs.bandwidth);
    }
    if (costs.consciousness !== undefined) {
      this.requireConsciousness(costs.consciousness);
    }
    if (costs.minConsciousnessPercent !== undefined) {
      this.requireConsciousnessPercent(costs.minConsciousnessPercent);
    }
    if (costs.thermal !== undefined && this.maxStats) {
      this.requireThermalCapacity(costs.thermal);
    }
    if (costs.neural !== undefined && this.maxStats) {
      this.requireNeuralCapacity(costs.neural);
    }
    return this;
  }

  /**
   * Check if validation passed
   */
  isValid(): boolean {
    return this.errors.length === 0;
  }

  /**
   * Get validation errors
   */
  getErrors(): ValidationError[] {
    return this.errors;
  }

  /**
   * Validate and throw ApiError if requirements not met
   */
  validate(): void {
    if (this.errors.length > 0) {
      const firstError = this.errors[0];
      throw ApiErrors.InsufficientResources(
        `${firstError.resource} (need ${firstError.required}, have ${firstError.available})`
      );
    }
  }

  /**
   * Reset validation state
   */
  reset(): this {
    this.errors = [];
    return this;
  }
}

/**
 * Quick validation helper for common scenarios
 */
export function validateResources(
  stats: CurrentStats,
  costs: ResourceCost,
  maxStats?: MaxStats
): void {
  new ResourceValidator(stats, maxStats).requireResources(costs).validate();
}
