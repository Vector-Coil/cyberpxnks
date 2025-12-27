-- Grant protocol access to users
-- This script can be used to manually grant protocol access or as a reference for 
-- implementing automatic protocol unlocks through gigs, reputation, or scan discoveries

-- Example 1: Grant protocol access to a specific user
-- INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
-- VALUES (?, ?, 'gig_completed');

-- Example 2: Grant initial protocol to all existing users
-- Useful for giving everyone access to a starter protocol
INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
SELECT id, 1, 'initial_access' 
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM user_protocol_access 
  WHERE user_id = users.id AND protocol_id = 1
);

-- Example 3: View all users and their protocol access
-- SELECT 
--   u.username,
--   u.fid,
--   p.name as protocol_name,
--   upa.unlock_method,
--   upa.unlocked_at
-- FROM users u
-- LEFT JOIN user_protocol_access upa ON u.id = upa.user_id
-- LEFT JOIN protocols p ON upa.protocol_id = p.id
-- ORDER BY u.username, upa.unlocked_at DESC;

-- Example 4: Grant protocol based on completed gig
-- INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
-- SELECT ugh.user_id, gigs.protocol_reward_id, 'gig_completed'
-- FROM user_gig_history ugh
-- INNER JOIN gigs ON ugh.gig_id = gigs.id
-- WHERE gigs.protocol_reward_id IS NOT NULL
-- AND ugh.status = 'completed';
