-- Verify indexes are created and being used
-- Run these to check performance improvements

-- 1. Check if indexes exist
SHOW INDEXES FROM users WHERE Key_name LIKE 'idx_%';
SHOW INDEXES FROM user_stats WHERE Key_name LIKE 'idx_%';
SHOW INDEXES FROM user_loadout WHERE Key_name LIKE 'idx_%';

-- 2. Test query performance with EXPLAIN
-- Should show "Using index" in Extra column
EXPLAIN SELECT id FROM users WHERE fid = 300187;

-- 3. Test stats query
EXPLAIN SELECT 
  u.cognition, u.power, u.resilience,
  c.class_clock_speed, c.class_cooling
FROM users u
LEFT JOIN classes c ON u.class_id = c.id
WHERE u.fid = 300187;

-- 4. Test loadout query
EXPLAIN SELECT * FROM user_loadout WHERE user_id = 6 AND slot_type = 'hardware';

-- 5. Check query execution stats
SELECT * FROM information_schema.PROCESSLIST WHERE db = 'cyberpxnks';
