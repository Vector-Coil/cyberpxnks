-- Migration: Add Combat Stats System
-- This adds the necessary columns and tables for the combat stats feature

-- Step 1: Add combat stats columns to user_stats table
ALTER TABLE user_stats
  -- Tactical stat (base, modifier)
  ADD COLUMN base_tac INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_tac INT DEFAULT 0 NOT NULL,
  
  -- Smart Tech stat (base, modifier)
  ADD COLUMN base_smt INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_smt INT DEFAULT 0 NOT NULL,
  
  -- Offense stat (base, modifier)
  ADD COLUMN base_off INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_off INT DEFAULT 0 NOT NULL,
  
  -- Defense stat (base, modifier)
  ADD COLUMN base_def INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_def INT DEFAULT 0 NOT NULL,
  
  -- Evasion stat (base, modifier)
  ADD COLUMN base_evn INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_evn INT DEFAULT 0 NOT NULL,
  
  -- Stealth stat (base, modifier)
  ADD COLUMN base_sth INT DEFAULT 0 NOT NULL,
  ADD COLUMN mod_sth INT DEFAULT 0 NOT NULL;

-- Step 2: Create arsenal_modifiers table
-- This table stores the combat stat bonuses for each arsenal item
CREATE TABLE IF NOT EXISTS arsenal_modifiers (
  item_id INT PRIMARY KEY,
  tactical INT DEFAULT 0 NOT NULL,
  smart_tech INT DEFAULT 0 NOT NULL,
  offense INT DEFAULT 0 NOT NULL,
  defense INT DEFAULT 0 NOT NULL,
  evasion INT DEFAULT 0 NOT NULL,
  stealth INT DEFAULT 0 NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Step 3: Add indexes for performance
CREATE INDEX idx_arsenal_modifiers_item ON arsenal_modifiers(item_id);

-- Step 4: Add combat stat columns to classes table (for base values)
ALTER TABLE classes
  ADD COLUMN class_tac INT DEFAULT 0 NOT NULL,
  ADD COLUMN class_smt INT DEFAULT 0 NOT NULL,
  ADD COLUMN class_off INT DEFAULT 0 NOT NULL,
  ADD COLUMN class_def INT DEFAULT 0 NOT NULL,
  ADD COLUMN class_evn INT DEFAULT 0 NOT NULL,
  ADD COLUMN class_sth INT DEFAULT 0 NOT NULL;

-- Note: After running this migration, you need to:
-- 1. Update the classes table with appropriate combat stat values for each class
-- 2. Run the initialization script to copy class combat stats to existing users (base values only)
-- 3. Populate arsenal_modifiers table with item bonuses
-- 4. Totals are calculated on-the-fly as base + mod (not stored in database)
