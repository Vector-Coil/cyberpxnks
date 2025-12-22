-- Consumable Effects System
-- Stores effect definitions and tracks active temporary buffs

-- Effect definitions for consumable items
CREATE TABLE IF NOT EXISTS consumable_effects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  effect_type ENUM(
    -- Instant restoration effects (duration_minutes = NULL)
    'restore_stamina', 'restore_consciousness', 'restore_charge', 
    'restore_neural', 'restore_thermal', 'restore_bandwidth',
    -- Instant debuff effects (duration_minutes = NULL)
    'increase_neural', 'increase_thermal',
    -- Temporary buff effects (duration_minutes = value)
    'buff_consciousness', 'buff_stamina', 'buff_charge',
    'buff_neural', 'buff_thermal', 'buff_bandwidth',
    'buff_cognition', 'buff_insight', 'buff_interface', 
    'buff_power', 'buff_resilience', 'buff_agility',
    'reduce_cooldown'
  ) NOT NULL,
  effect_value INT NOT NULL COMMENT 'Amount restored/buffed or debuff value',
  duration_minutes INT NULL COMMENT 'NULL for instant effects, value for temporary buffs',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Active temporary buffs from consumables
CREATE TABLE IF NOT EXISTS active_consumable_buffs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  effect_type VARCHAR(50) NOT NULL,
  effect_value INT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Example: Energy drink that restores 20 stamina
-- INSERT INTO consumable_effects (item_id, effect_type, effect_value, duration_minutes, description)
-- VALUES (1, 'restore_stamina', 20, NULL, 'Restores 20 stamina instantly');

-- Example: Neuro-enhancer that buffs cognition for 1 hour
-- INSERT INTO consumable_effects (item_id, effect_type, effect_value, duration_minutes, description)
-- VALUES (2, 'buff_cognition', 5, 60, 'Increases cognition by 5 for 1 hour');

-- Example: Combat stim with tradeoffs - increased stamina but thermal spike
-- INSERT INTO consumable_effects (item_id, effect_type, effect_value, duration_minutes, description)
-- VALUES 
--   (3, 'buff_stamina', 50, 15, 'Increases max stamina by 50 for 15 minutes'),
--   (3, 'increase_thermal', 25, NULL, 'Immediate thermal load increase of 25');

-- Example: Powerful neural booster with severe side effects
-- INSERT INTO consumable_effects (item_id, effect_type, effect_value, duration_minutes, description)
-- VALUES 
--   (4, 'buff_cognition', 30, 20, 'Massive cognition boost'),
--   (4, 'buff_consciousness', 40, 20, 'Increased consciousness capacity'),
--   (4, 'increase_neural', 35, NULL, 'Severe neural load spike'),
--   (4, 'increase_thermal', 20, NULL, 'Thermal overload risk');

SELECT 'Consumable effects tables ready!' AS status;
