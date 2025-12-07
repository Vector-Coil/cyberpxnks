// Stat calculation utilities for combining user stats, tech stats, and hardware modifiers

export interface UserStats {
  cognition: number;
  insight: number;
  interface: number;
  power: number;
  resilience: number;
  agility: number;
}

export interface TechStats {
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

export interface CalculatedStats {
  max_consciousness: number;
  max_stamina: number;
  max_charge: number;
  max_thermal: number;
  max_neural: number;
  max_bandwidth: number;
}

export interface CombinedTechStats {
  clock_speed: number;
  cooling: number;
  signal_noise: number;
  latency: number;
  decryption: number;
  cache: number;
  // Display modifiers from hardware
  clock_speed_mod: number;
  cooling_mod: number;
  signal_noise_mod: number;
  latency_mod: number;
  decryption_mod: number;
  cache_mod: number;
}

/**
 * Calculate derived stats from user stats, tech stats, and hardware modifiers
 */
export function calculateStats(
  userStats: UserStats,
  techStats: TechStats,
  hardwareModifiers: HardwareModifiers
): CalculatedStats & CombinedTechStats {
  // Combine tech stats with hardware modifiers
  const clock_speed = techStats.clock_speed + hardwareModifiers.processor;
  const cooling = techStats.cooling + hardwareModifiers.heat_sink;
  const signal_noise = techStats.signal_noise + hardwareModifiers.memory + hardwareModifiers.lifi;
  const latency = techStats.latency + hardwareModifiers.lifi;
  const decryption = techStats.decryption + hardwareModifiers.encryption;
  const cache = techStats.cache + hardwareModifiers.memory;

  // Calculate derived stats
  const max_consciousness = userStats.cognition * userStats.resilience;
  const max_stamina = userStats.power * userStats.resilience;
  const max_charge = clock_speed + hardwareModifiers.cell_capacity;
  const max_thermal = clock_speed + cooling + hardwareModifiers.heat_sink;

  // Calculate bandwidth: ((Processor + Memory) × ((Clock Speed + Cache) / Latency)) / Lifi
  const bandwidth_numerator = (hardwareModifiers.processor + hardwareModifiers.memory) * 
                               ((clock_speed + cache) / (latency || 1)); // Prevent division by zero
  const max_bandwidth = Math.floor(bandwidth_numerator / (hardwareModifiers.lifi || 1));
  
  // Neural load capacity based on mental attributes and data processing capability
  const max_neural = userStats.cognition + userStats.resilience + max_bandwidth;

  return {
    // Calculated stats
    max_consciousness,
    max_stamina,
    max_charge,
    max_thermal,
    max_neural,
    max_bandwidth,
    // Combined tech stats
    clock_speed,
    cooling,
    signal_noise,
    latency,
    decryption,
    cache,
    // Hardware modifiers for display
    clock_speed_mod: hardwareModifiers.processor,
    cooling_mod: hardwareModifiers.heat_sink,
    signal_noise_mod: hardwareModifiers.memory + hardwareModifiers.lifi,
    latency_mod: hardwareModifiers.lifi,
    decryption_mod: hardwareModifiers.encryption,
    cache_mod: hardwareModifiers.memory
  };
}

/**
 * Create empty hardware modifiers (for when no hardware is equipped)
 */
export function emptyHardwareModifiers(): HardwareModifiers {
  return {
    cell_capacity: 0,
    heat_sink: 0,
    processor: 0,
    memory: 0,
    lifi: 0,
    encryption: 0
  };
}
