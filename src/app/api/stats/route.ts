import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';
import { validateFid, handleApiError } from '../../../lib/api/errors';
import { getUserIdByFid } from '../../../lib/api/userUtils';
import { logger } from '../../../lib/logger';

// GET /api/stats?fid=300187
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fid = validateFid(url.searchParams.get('fid'), 300187);

    logger.apiRequest('GET', '/api/stats', { fid });

    const pool = await getDbPool();
    
    // Use StatsService for centralized stat management
    const stats = await StatsService.getStatsByFid(pool, fid);

    // Get user ID for base stats query
    const userId = await getUserIdByFid(pool, fid);

    // Get base stats from user_stats table for hardware preview calculations
    const [userStatsRows] = await pool.execute(
      `SELECT total_clock, total_cooling, total_signal, total_latency, total_crypt, total_cache
       FROM user_stats WHERE user_id = ?`,
      [userId]
    );
    const baseStats = (userStatsRows as any[])[0] || {};

    // Transform to match old API format for backward compatibility
    return NextResponse.json({
      // User attributes (base stats)
      cognition: stats.attributes.cognition,
      insight: stats.attributes.insight,
      interface: stats.attributes.interface,
      power: stats.attributes.power,
      resilience: stats.attributes.resilience,
      agility: stats.attributes.agility,
      unallocated_points: stats.attributes.unallocated_points,
      // Current stats
      current_consciousness: stats.current.consciousness,
      current_stamina: stats.current.stamina,
      current_charge: stats.current.charge,
      current_bandwidth: stats.current.bandwidth,
      current_thermal: stats.current.thermal,
      current_neural: stats.current.neural,
      // Max stats
      max_consciousness: stats.max.consciousness,
      max_stamina: stats.max.stamina,
      max_charge: stats.max.charge,
      max_bandwidth: stats.max.bandwidth,
      max_thermal: stats.max.thermal,
      max_neural: stats.max.neural,
      // Tech stats (calculated with hardware)
      clock_speed: stats.tech.clock_speed,
      cooling: stats.tech.cooling,
      signal_noise: stats.tech.signal_noise,
      latency: stats.tech.latency,
      decryption: stats.tech.decryption,
      cache: stats.tech.cache,
      // Base stats (from user_stats, before hardware) - for hardware preview
      total_clock: baseStats.total_clock || 0,
      total_cooling: baseStats.total_cooling || 0,
      total_signal: baseStats.total_signal || 0,
      total_latency: baseStats.total_latency || 0,
      total_crypt: baseStats.total_crypt || 0,
      total_cache: baseStats.total_cache || 0,
      // Hardware modifiers
      total_cell_capacity: stats.hardware.cell_capacity,
      total_processor: stats.hardware.processor,
      total_heat_sink: stats.hardware.heat_sink,
      total_memory: stats.hardware.memory,
      total_lifi: stats.hardware.lifi,
      total_encryption: stats.hardware.encryption,
      // Slimsoft modifiers
      slimsoft_decryption: stats.slimsoft.decryption,
      slimsoft_encryption: stats.slimsoft.encryption,
      slimsoft_antivirus: stats.slimsoft.antivirus,
      slimsoft_consciousness_regen: stats.slimsoft.consciousness_regen,
      slimsoft_neural_load_rate: stats.slimsoft.neural_load_rate,
      slimsoft_thermal_load_rate: stats.slimsoft.thermal_load_rate,
      slimsoft_xp_multiplier: stats.slimsoft.xp_multiplier,
      slimsoft_credits_multiplier: stats.slimsoft.credits_multiplier,
      antivirus: stats.slimsoft.antivirus,
      // Combat stats (base from class)
      base_tac: stats.base_tac,
      base_smt: stats.base_smt,
      base_off: stats.base_off,
      base_def: stats.base_def,
      base_evn: stats.base_evn,
      base_sth: stats.base_sth,
      // Combat stats (mods from arsenal)
      mod_tac: stats.mod_tac,
      mod_smt: stats.mod_smt,
      mod_off: stats.mod_off,
      mod_def: stats.mod_def,
      mod_evn: stats.mod_evn,
      mod_sth: stats.mod_sth,
      // Combat stats (totals)
      tactical: stats.tactical,
      smart_tech: stats.smart_tech,
      offense: stats.offense,
      defense: stats.defense,
      evasion: stats.evasion,
      stealth: stats.stealth,
      // Metadata
      _source: 'StatsService',
      lastRegeneration: stats.lastRegeneration,
      updatedAt: stats.updatedAt
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/stats');
  }
}
