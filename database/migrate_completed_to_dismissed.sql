-- Migration: Update all 'completed' actions to 'dismissed'
-- Date: 2025-12-14
-- Purpose: Retroactively set final status to 'dismissed' for all previously viewed actions
-- since we've established the lifecycle: NULL → 'completed' → 'dismissed'

-- Update all Scout actions
UPDATE user_zone_history 
SET result_status = 'dismissed' 
WHERE action_type = 'Scouted' 
AND result_status = 'completed';

-- Update all Breach actions (both physical and remote)
UPDATE user_zone_history 
SET result_status = 'dismissed' 
WHERE action_type IN ('Breached', 'RemoteBreach')
AND result_status = 'completed';

-- Update all Explore actions
UPDATE user_zone_history 
SET result_status = 'dismissed' 
WHERE action_type = 'Exploring' 
AND result_status = 'completed';

-- Note: OvernetScan actions should already be 'dismissed' from the previous implementation
-- But we'll update any that might be 'completed' just to be safe
UPDATE user_zone_history 
SET result_status = 'dismissed' 
WHERE action_type = 'OvernetScan' 
AND result_status = 'completed';

-- Verify the migration
SELECT 
    action_type,
    result_status,
    COUNT(*) as count
FROM user_zone_history
GROUP BY action_type, result_status
ORDER BY action_type, result_status;
