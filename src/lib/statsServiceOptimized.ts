// StatsService - OPTIMIZED VERSION
// Single query with JOINs for maximum performance

import { Pool } from 'mysql2/promise';

export async function getStatsOptimized(pool: Pool, userId: number) {
  const [rows] = await pool.execute(
    `SELECT 
      -- User attributes
      u.cognition, u.insight, u.interface, u.power, u.resilience, u.agility,
      -- Class base stats
      c.class_clock_speed, c.class_cooling, c.class_signal_noise,
      c.class_latency, c.class_decryption, c.class_cache,
      -- Current meter values
      us.current_consciousness, us.current_stamina, us.current_charge, 
      us.current_bandwidth, us.current_thermal, us.current_neural,
      us.base_clock, us.base_cooling, us.base_signal, 
      us.base_latency, us.base_crypt, us.base_cache,
      us.last_regeneration, us.updated_at,
      -- Equipment summary (aggregated hardware) - will be NULL if view doesn't exist
      us.total_cell_capacity, us.total_processor, us.total_heat_sink,
      us.total_memory, us.total_lifi, us.total_encryption, us.antivirus
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN user_stats us ON us.user_id = u.id
    WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if ((rows as any[]).length === 0) {
    throw new Error(`User ${userId} not found`);
  }

  const data = (rows as any[])[0];

  // Parse and calculate everything from the single row
  const attributes = {
    cognition: Number(data.cognition) || 1,
    power: Number(data.power) || 1,
    resilience: Number(data.resilience) || 1
  };

  const baseStats = {
    clock_speed: Number(data.base_clock ?? data.class_clock_speed) || 0,
    cooling: Number(data.base_cooling ?? data.class_cooling) || 0,
    cache: Number(data.base_cache ?? data.class_cache) || 0,
    latency: Number(data.base_latency ?? data.class_latency) || 1,
    decryption: Number(data.base_crypt ?? data.class_decryption) || 0
  };

  const hardware = {
    processor: Number(data.total_processor) || 0,
    heat_sink: Number(data.total_heat_sink) || 0,
    cell_capacity: Number(data.total_cell_capacity) || 0,
    memory: Number(data.total_memory) || 0,
    lifi: Number(data.total_lifi) || 0,
    encryption: Number(data.total_encryption) || 0
  };

  // Calculate tech stats
  const tech = {
    clock_speed: Number(baseStats.clock_speed) + Number(hardware.processor),
    cooling: Number(baseStats.cooling) + Number(hardware.heat_sink),
    cache: Number(baseStats.cache) + Number(hardware.memory),
    latency: Number(baseStats.latency) + Number(hardware.lifi)
  };

  // Calculate bandwidth first (needed for neural)
  const bandwidth = Math.floor(
    ((Number(hardware.processor) + Number(hardware.memory)) * 
     ((Number(tech.clock_speed) + Number(tech.cache)) / (Number(tech.latency) || 1))) / 
    (Number(hardware.lifi) || 1)
  );

  // Calculate max stats
  const max = {
    consciousness: Number(attributes.cognition) * Number(attributes.resilience),
    stamina: Number(attributes.power) * Number(attributes.resilience),
    charge: Number(tech.clock_speed) + Number(hardware.cell_capacity),
    thermal: Number(tech.clock_speed) + Number(tech.cooling),
    neural: Number(attributes.cognition) + Number(attributes.resilience) + bandwidth,
    bandwidth: bandwidth
  };

  return {
    current: {
      consciousness: Number(data.current_consciousness) || 0,
      stamina: Number(data.current_stamina) || 0,
      charge: Number(data.current_charge) || 0,
      bandwidth: Number(data.current_bandwidth) || 0,
      thermal: Number(data.current_thermal) || 0,
      neural: Number(data.current_neural) || 0
    },
    max,
    tech,
    hardware,
    attributes
  };
}
