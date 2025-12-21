-- Normalize zone_districts.active field to proper boolean
-- Converts VARCHAR values ('true', 'yes', 'false') to TINYINT(1)

-- Create backup table
CREATE TABLE zone_districts_backup_20251220 AS SELECT * FROM zone_districts;

-- Convert active column to proper boolean type
ALTER TABLE zone_districts 
  MODIFY COLUMN active TINYINT(1) NOT NULL DEFAULT 0 
  COMMENT 'District active status (0=inactive, 1=active)';

-- Normalize existing data
UPDATE zone_districts 
SET active = CASE 
  WHEN active IN ('true', 'yes', 'TRUE', 'YES', '1', 1) THEN 1
  ELSE 0
END;

-- Add index for performance on active status queries
CREATE INDEX idx_district_active ON zone_districts(active);

-- Verify results
SELECT id, name, active, 
       CASE WHEN active = 1 THEN 'Active' ELSE 'Inactive' END as status
FROM zone_districts 
ORDER BY active DESC, name;
