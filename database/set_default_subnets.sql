-- Set default access subnets
-- Subnets with is_default_access = 1 will be visible to all users without explicit grants

-- Set HUMANCORP (or subnet ID 1) as default access
-- Adjust the ID as needed based on your subnet IDs
UPDATE subnets 
SET is_default_access = 1 
WHERE name = 'HUMANCORP' OR id = 1;

-- View all default access subnets
SELECT id, name, description, is_default_access 
FROM subnets 
WHERE is_default_access = 1;
