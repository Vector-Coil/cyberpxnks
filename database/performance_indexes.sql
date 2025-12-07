-- Performance Optimization Indexes
-- Run these to significantly speed up common queries

-- User lookups by FID (used in almost every API call)
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);

-- User stats lookups
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Equipment/loadout queries
CREATE INDEX IF NOT EXISTS idx_user_loadout_user_slot ON user_loadout(user_id, slot_type);
CREATE INDEX IF NOT EXISTS idx_user_loadout_item ON user_loadout(item_id);

-- Inventory queries
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_equipped ON user_inventory(user_id, is_equipped);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item ON user_inventory(item_id);

-- Slimsoft and hardware lookups
CREATE INDEX IF NOT EXISTS idx_slimsoft_effects_item ON slimsoft_effects(item_id);
CREATE INDEX IF NOT EXISTS idx_hardware_modifiers_item ON hardware_modifiers(item_id);

-- Zone/breach history queries
CREATE INDEX IF NOT EXISTS idx_user_zone_history_user_action ON user_zone_history(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_user_zone_history_end_time ON user_zone_history(end_time);
CREATE INDEX IF NOT EXISTS idx_user_zone_history_user_end ON user_zone_history(user_id, end_time);

-- Gig history
CREATE INDEX IF NOT EXISTS idx_gig_history_user ON gig_history(user_id);
CREATE INDEX IF NOT EXISTS idx_gig_history_gig ON gig_history(gig_id);

-- Contact lookups
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact ON contacts(contact_user_id);

-- Level thresholds
CREATE INDEX IF NOT EXISTS idx_level_thresholds_level ON level_thresholds(level);

-- Activity ledger (if it gets large)
CREATE INDEX IF NOT EXISTS idx_activity_ledger_user_time ON activity_ledger(user_id, timestamp);

-- Class lookups
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_users_alignment ON users(alignment_id);

-- Show created indexes
SHOW INDEXES FROM users;
SHOW INDEXES FROM user_stats;
SHOW INDEXES FROM user_loadout;
