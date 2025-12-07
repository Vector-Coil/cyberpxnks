import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';

// GET /api/stats?fid=300187
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fidParam = url.searchParams.get('fid') || '300187';
    const fid = parseInt(fidParam, 10);

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    const pool = await getDbPool();
    
    // Use StatsService for centralized stat management
    const stats = await StatsService.getStatsByFid(pool, fid);

    // Transform to match old API format for backward compatibility
    return NextResponse.json({
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
      // Tech stats (calculated)
      clock_speed: stats.tech.clock_speed,
      cooling: stats.tech.cooling,
      signal_noise: stats.tech.signal_noise,
      latency: stats.tech.latency,
      decryption: stats.tech.decryption,
      cache: stats.tech.cache,
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
      // Metadata
      _source: 'StatsService',
      lastRegeneration: stats.lastRegeneration,
      updatedAt: stats.updatedAt
    });
  } catch (err: any) {
    console.error('API /api/stats error:', err);
    console.error('Error stack:', err.stack);
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: err.message,
      details: err.toString() 
    }, { status: 500 });
  }
}
