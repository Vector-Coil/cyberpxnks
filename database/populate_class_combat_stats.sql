-- Populate Combat Stats for Classes
-- Run this after add_combat_stats.sql migration
-- These values define base combat stats for each class archetype

-- Street Samurai: High offense and defense, moderate tactical
-- Focus: Direct combat superiority
UPDATE classes SET 
  class_tac = 8,   -- Tactical: Moderate combat planning
  class_smt = 3,   -- Smart Tech: Low tech interface
  class_off = 15,  -- Offense: Highest direct damage
  class_def = 12,  -- Defense: High survivability
  class_evn = 4,   -- Evasion: Low dodge (heavy armor)
  class_sth = 2    -- Stealth: Lowest (loud and proud)
WHERE name = 'Street Samurai';

-- Netrunner: High smart tech and tactical, low physical combat
-- Focus: Technology-based combat and hacking
UPDATE classes SET 
  class_tac = 12,  -- Tactical: High strategic planning
  class_smt = 15,  -- Smart Tech: Highest tech interface
  class_off = 5,   -- Offense: Low physical damage
  class_def = 4,   -- Defense: Low physical resilience  
  class_evn = 8,   -- Evasion: Moderate dodge
  class_sth = 6    -- Stealth: Moderate stealth
WHERE name = 'Netrunner';

-- Nomad: Balanced all-around stats with resourcefulness
-- Focus: Versatility and adaptability
UPDATE classes SET 
  class_tac = 10,  -- Tactical: Balanced combat planning
  class_smt = 7,   -- Smart Tech: Moderate tech use
  class_off = 8,   -- Offense: Balanced damage
  class_def = 9,   -- Defense: Balanced survivability
  class_evn = 7,   -- Evasion: Balanced dodge
  class_sth = 8    -- Stealth: Moderate stealth
WHERE name = 'Nomad';

-- If you have other classes, add them here following the same pattern
-- Example for a Stealth/Assassin type:
-- UPDATE classes SET 
--   class_tac = 11, class_smt = 6, class_off = 10,
--   class_def = 5, class_evn = 13, class_sth = 15
-- WHERE name = 'Shadow';

SELECT 'Class combat stats populated!' AS status;
