/**
 * Shared TypeScript interfaces used across the application
 */

export interface NavData {
  username: string;
  profileImage?: string;
  cxBalance: number;
}

export interface UserStats {
  // User base stats
  cognition: number;
  insight: number;
  interface: number;
  power: number;
  resilience: number;
  agility: number;

  // Current meter values
  current_consciousness: number;
  current_stamina: number;
  current_charge: number;
  current_thermal: number;
  current_bandwidth: number;
  current_neural: number;

  // Note: Max values are now calculated dynamically by StatsService
  // and are not stored in the database anymore

  // Tech stats
  clock_speed: number;
  cooling: number;
  signal_noise: number;
  latency: number;
  decryption: number;
  cache: number;

  // Tech stat modifiers from hardware
  clock_speed_mod: number;
  cooling_mod: number;
  signal_noise_mod: number;
  latency_mod: number;
  decryption_mod: number;
  cache_mod: number;

  // User progression
  level: number;
  xp: number;
  unallocated_points: number;
  street_cred: number;
  location?: number;
}

export interface Zone {
  id: number;
  name: string;
  description: string;
  district_id: number;
  district_name?: string;
  image_url?: string;
  unlocked?: boolean;
}

export interface District {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
}

export interface POI {
  id: number;
  name: string;
  description: string;
  zone_id: number;
  image_url?: string;
  required_level?: number;
  xp_reward?: number;
  unlocked?: boolean;
}

export interface ZoneHistory {
  id: number;
  action_type: string;
  timestamp: string;
  gains_data?: string;
  username?: string;
  zone_name?: string;
  poi_name?: string;
}

export interface HardwareItem {
  id: number;
  name: string;
  item_type: string;
  is_equipped?: boolean;
  tier?: number;
  description?: string;
  image_url?: string;
}

export interface SlimsoftEffect {
  item_id: number;
  effect_type: string;
  effect_value: number;
  target_action?: string;
}
