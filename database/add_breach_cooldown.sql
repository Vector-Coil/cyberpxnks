-- Add breach cooldown tracking
-- After a failed breach, the POI will be on cooldown for 60 minutes

-- Add cooldown_until field to track when a POI can be breached again
ALTER TABLE user_zone_history 
ADD COLUMN cooldown_until DATETIME NULL 
COMMENT 'When breach cooldown expires for failed attempts' 
AFTER result_status;

-- Index for quick cooldown checks
CREATE INDEX idx_cooldown ON user_zone_history(user_id, poi_id, cooldown_until);
