// StatsService - Centralized stats management system
// Phase 1: Read-only service that calculates stats on-demand

import { Pool } from 'mysql2/promise';

// ===== INTERFACES =====

export interface UserAttributes {
  cognition: number;
  insight: number;
  interface: number;
  power: number;
  resilience: number;
  agility: number;
}

export interface ClassStats {
  clock_speed: number;
  cooling: number;
  signal_noise: number;
  latency: number;
  decryption: number;
  cache: number;
}

export interface HardwareModifiers {
  cell_capacity: number;
  heat_sink: number;
  processor: number;
  memory: number;
  lifi: number;
  encryption: number;
}

export interface SlimsoftModifiers {
  decryption: number;
  encryption: number;
  antivirus: number;
  consciousness_regen: number;
  neural_load_rate: number;
  thermal_load_rate: number;
  xp_multiplier: number;
  credits_multiplier: number;
}

export interface CurrentStats {
  consciousness: number;
  stamina: number;
  charge: number;
  bandwidth: number;
  thermal: number;
  neural: number;
}

export interface MaxStats {
  consciousness: number;
  stamina: number;
  charge: number;
  bandwidth: number;
  thermal: number;
  neural: number;
}

export interface TechStats {
  clock_speed: number;
  cooling: number;
  signal_noise: number;
  latency: number;
  decryption: number;
  cache: number;
}

export interface CombatStats {
  tactical: number;
  smart_tech: number;
  offense: number;
  defense: number;
  evasion: number;
  stealth: number;
}

export interface CompleteStats {
  // Current values
  current: CurrentStats;
  // Calculated max values
  max: MaxStats;
  // Tech stats (base + hardware + slimsoft)
  tech: TechStats;
  // Combat stats (base + arsenal modifiers)
  combat: CombatStats;
  // User attributes
  attributes: UserAttributes;
  // Hardware modifiers (from equipped cyberdeck)
  hardware: HardwareModifiers;
  // Slimsoft modifiers (from equipped slimsoft)
  slimsoft: SlimsoftModifiers;
  // Metadata
  lastRegeneration: Date | null;
  updatedAt: Date | null;
}

// ===== STATS SERVICE =====

export class StatsService {
  private pool: Pool;
  private userId: number;

  constructor(pool: Pool, userId: number) {
    this.pool = pool;
    this.userId = userId;
  }

  /**
   * Get complete calculated stats snapshot
   * This is the single source of truth for all stat reads
   */
  async getStats(): Promise<CompleteStats> {
    // Step 1: Get user attributes and class base stats
    const [userRows] = await this.pool.execute(
      `SELECT 
        u.cognition, u.insight, u.interface, u.power, u.resilience, u.agility,
        c.class_clock_speed, c.class_cooling, c.class_signal_noise,
        c.class_latency, c.class_decryption, c.class_cache
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = ? LIMIT 1`,
      [this.userId]
    );

    if ((userRows as any[]).length === 0) {
      throw new Error(`User ${this.userId} not found`);
    }

    const user = (userRows as any[])[0];
    
    const attributes: UserAttributes = {
      cognition: user.cognition || 1,
      insight: user.insight || 1,
      interface: user.interface || 1,
      power: user.power || 1,
      resilience: user.resilience || 1,
      agility: user.agility || 1
    };

    const classStats: ClassStats = {
      clock_speed: user.class_clock_speed || 0,
      cooling: user.class_cooling || 0,
      signal_noise: user.class_signal_noise || 0,
      latency: user.class_latency || 1,
      decryption: user.class_decryption || 0,
      cache: user.class_cache || 0
    };

// Step 2: Get current meter values and combat stats from user_stats
    const [statsRows] = await this.pool.execute(
      `SELECT 
        current_consciousness, current_stamina, current_charge,
        current_bandwidth, current_thermal, current_neural,
        base_clock, base_cooling, base_signal, base_latency, base_crypt, base_cache,
        base_tac, mod_tac, base_smt, mod_smt, base_off, mod_off,
        base_def, mod_def, base_evn, mod_evn, base_sth, mod_sth,
        last_regeneration, updated_at
      FROM user_stats 
      WHERE user_id = ? LIMIT 1`,
      [this.userId]
    );

    if ((statsRows as any[]).length === 0) {
      throw new Error(`Stats not found for user ${this.userId}`);
    }

    const stats = (statsRows as any[])[0];

    const current: CurrentStats = {
      consciousness: stats.current_consciousness || 0,
      stamina: stats.current_stamina || 0,
      charge: stats.current_charge || 0,
      bandwidth: stats.current_bandwidth || 0,
      thermal: stats.current_thermal || 0,
      neural: stats.current_neural || 0
    };

    // Use base stats from user_stats (which may have been upgraded)
    const baseStats: ClassStats = {
      clock_speed: stats.base_clock ?? classStats.clock_speed,
      cooling: stats.base_cooling ?? classStats.cooling,
      signal_noise: stats.base_signal ?? classStats.signal_noise,
      latency: stats.base_latency ?? classStats.latency,
      decryption: stats.base_crypt ?? classStats.decryption,
      cache: stats.base_cache ?? classStats.cache
    };

    // Step 3: Get equipment modifiers
    // Try view first, fall back to direct query if view doesn't exist or has no data
    let equipRows: any[];
    try {
      [equipRows] = await this.pool.execute(
        `SELECT * FROM user_equipment_summary WHERE user_id = ? LIMIT 1`,
        [this.userId]
      ) as any[];
    } catch (viewError) {
      // View might not exist, query directly
      console.warn('Equipment view not available, using direct query:', viewError);
      equipRows = [];
    }

    let hardware: HardwareModifiers;
    let slimsoft: SlimsoftModifiers;

    if ((equipRows as any[]).length > 0) {
      const equip = (equipRows as any[])[0];
      hardware = {
        cell_capacity: Number(equip.hw_cell_capacity) || 0,
        heat_sink: Number(equip.hw_heat_sink) || 0,
        processor: Number(equip.hw_processor) || 0,
        memory: Number(equip.hw_memory) || 0,
        lifi: Number(equip.hw_lifi) || 0,
        encryption: Number(equip.hw_encryption) || 0
      };

      slimsoft = {
        decryption: Number(equip.ss_decryption) || 0,
        encryption: Number(equip.ss_encryption) || 0,
        antivirus: Number(equip.ss_antivirus) || 0,
        consciousness_regen: Number(equip.ss_consciousness_regen) || 0,
        neural_load_rate: Number(equip.ss_neural_load) || 0,
        thermal_load_rate: Number(equip.ss_thermal_load) || 0,
        xp_multiplier: 1 + ((Number(equip.ss_xp_bonus) || 0) / 100),
        credits_multiplier: 1 + ((Number(equip.ss_credits_bonus) || 0) / 100)
      };
    } else {
      // No equipment or view unavailable - fallback to user_stats stored values
      const [fallbackRows] = await this.pool.execute(
        `SELECT 
          total_cell_capacity, total_processor, total_heat_sink,
          total_memory, total_lifi, total_encryption, antivirus
        FROM user_stats WHERE user_id = ? LIMIT 1`,
        [this.userId]
      );
      
      if ((fallbackRows as any[]).length > 0) {
        const fb = (fallbackRows as any[])[0];
        hardware = {
          cell_capacity: fb.total_cell_capacity || 0,
          heat_sink: fb.total_heat_sink || 0,
          processor: fb.total_processor || 0,
          memory: fb.total_memory || 0,
          lifi: fb.total_lifi || 0,
          encryption: fb.total_encryption || 0
        };
        
        slimsoft = {
          decryption: 0,
          encryption: 0,
          antivirus: fb.antivirus || 0,
          consciousness_regen: 0,
          neural_load_rate: 0,
          thermal_load_rate: 0,
          xp_multiplier: 1,
          credits_multiplier: 1
        };
      } else {
        hardware = {
          cell_capacity: 0,
          heat_sink: 0,
          processor: 0,
          memory: 0,
          lifi: 0,
          encryption: 0
        };

        slimsoft = {
          decryption: 0,
          encryption: 0,
          antivirus: 0,
          consciousness_regen: 0,
          neural_load_rate: 0,
          thermal_load_rate: 0,
          xp_multiplier: 1,
          credits_multiplier: 1
        };
      }
    }

    // Step 4: Calculate tech stats (base + hardware + slimsoft)
    // Ensure numeric addition by explicitly converting to numbers
    const tech: TechStats = {
      clock_speed: Number(baseStats.clock_speed) + Number(hardware.processor),
      cooling: Number(baseStats.cooling) + Number(hardware.heat_sink),
      signal_noise: Number(baseStats.signal_noise) + Number(hardware.memory) + Number(hardware.lifi),
      latency: Number(baseStats.latency) + Number(hardware.lifi),
      decryption: Number(baseStats.decryption) + Number(hardware.encryption) + Number(slimsoft.decryption),
      cache: Number(baseStats.cache) + Number(hardware.memory)
    };

    // Step 5: Calculate max values using formulas
    // Ensure numeric addition by explicitly converting to numbers
    const bandwidth = Math.floor(
      ((Number(hardware.processor) + Number(hardware.memory)) * 
       ((Number(tech.clock_speed) + Number(tech.cache)) / (Number(tech.latency) || 1))) / 
      (Number(hardware.lifi) || 1)
    );

    const max: MaxStats = {
      consciousness: Number(attributes.cognition) * Number(attributes.resilience),
      stamina: Number(attributes.power) * Number(attributes.resilience),
      charge: Number(tech.clock_speed) + Number(hardware.cell_capacity),
      thermal: Number(tech.clock_speed) + Number(tech.cooling), // tech.cooling already includes hardware.heat_sink
      neural: Number(attributes.cognition) + Number(attributes.resilience) + bandwidth, // Mental capacity based on cognition, resilience, and data processing capability
      bandwidth: bandwidth
    };

    // Step 6: Calculate combat stats (base + mod, similar to tech stats)
    const combat: CombatStats = {
      tactical: (stats.base_tac || 0) + (stats.mod_tac || 0),
      smart_tech: (stats.base_smt || 0) + (stats.mod_smt || 0),
      offense: (stats.base_off || 0) + (stats.mod_off || 0),
      defense: (stats.base_def || 0) + (stats.mod_def || 0),
      evasion: (stats.base_evn || 0) + (stats.mod_evn || 0),
      stealth: (stats.base_sth || 0) + (stats.mod_sth || 0)
    };

    // Return complete snapshot
    return {
      current,
      max,
      tech,
      combat,
      attributes,
      hardware,
      slimsoft,
      lastRegeneration: stats.last_regeneration || null,
      updatedAt: stats.updated_at || null
    };
  }

  /**
   * Get stats by FID (convenience method)
   */
  static async getStatsByFid(pool: Pool, fid: number): Promise<CompleteStats> {
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );

    if ((userRows as any[]).length === 0) {
      throw new Error(`User with fid ${fid} not found`);
    }

    const userId = (userRows as any[])[0].id;
    const service = new StatsService(pool, userId);
    return service.getStats();
  }

  /**
   * Validate that current stats don't exceed max values
   * Returns true if stats are valid, false if they need capping
   */
  async validateStats(): Promise<boolean> {
    const stats = await this.getStats();
    
    return (
      stats.current.consciousness <= stats.max.consciousness &&
      stats.current.stamina <= stats.max.stamina &&
      stats.current.charge <= stats.max.charge &&
      stats.current.bandwidth <= stats.max.bandwidth
    );
  }

  /**
   * Modify stats with automatic validation and capping
   * All stat changes should go through this method
   */
  async modifyStats(changes: {
    consciousness?: number;
    stamina?: number;
    charge?: number;
    thermal?: number;
    neural?: number;
    bandwidth?: number;
  }): Promise<CompleteStats> {
    // Get current stats and max values
    const stats = await this.getStats();

    // Calculate new values (changes are deltas: +5, -10, etc.)
    const newValues = {
      consciousness: Math.max(0, Math.min(
        stats.max.consciousness,
        stats.current.consciousness + (changes.consciousness || 0)
      )),
      stamina: Math.max(0, Math.min(
        stats.max.stamina,
        stats.current.stamina + (changes.stamina || 0)
      )),
      charge: Math.max(0, Math.min(
        stats.max.charge,
        stats.current.charge + (changes.charge || 0)
      )),
      thermal: Math.max(0, Math.min(
        stats.max.thermal,
        stats.current.thermal + (changes.thermal || 0)
      )),
      neural: Math.max(0, Math.min(
        stats.max.neural,
        stats.current.neural + (changes.neural || 0)
      )),
      bandwidth: Math.max(0, Math.min(
        stats.max.bandwidth,
        stats.current.bandwidth + (changes.bandwidth || 0)
      ))
    };

    // Update database
    await this.pool.execute(
      `UPDATE user_stats 
       SET current_consciousness = ?,
           current_stamina = ?,
           current_charge = ?,
           current_thermal = ?,
           current_neural = ?,
           current_bandwidth = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [
        newValues.consciousness,
        newValues.stamina,
        newValues.charge,
        newValues.thermal,
        newValues.neural,
        newValues.bandwidth,
        this.userId
      ]
    );

    return this.getStats();
  }

  /**
   * Cap all current stats at their calculated max values
   * Use after equipment changes or level ups
   */
  async capAtMax(): Promise<CompleteStats> {
    const stats = await this.getStats();

    await this.pool.execute(
      `UPDATE user_stats 
       SET current_consciousness = LEAST(current_consciousness, ?),
           current_stamina = LEAST(current_stamina, ?),
           current_charge = LEAST(current_charge, ?),
           current_thermal = LEAST(current_thermal, ?),
           current_neural = LEAST(current_neural, ?),
           current_bandwidth = LEAST(current_bandwidth, ?),
           updated_at = NOW()
       WHERE user_id = ?`,
      [
        stats.max.consciousness,
        stats.max.stamina,
        stats.max.charge,
        stats.max.thermal,
        stats.max.neural,
        stats.max.bandwidth,
        this.userId
      ]
    );

    return this.getStats();
  }
}
