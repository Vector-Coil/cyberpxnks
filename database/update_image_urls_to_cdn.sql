-- Update all image_url paths in database to use CDN
-- Run this script to update existing database records

-- Update gigs table
UPDATE gigs 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE gigs 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update contacts table
UPDATE contacts 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE contacts 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update zones/POI table
UPDATE points_of_interest 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE points_of_interest 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update hardware table
UPDATE hardware 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE hardware 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update slimsoft table
UPDATE slimsoft 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE slimsoft 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update items/consumables table
UPDATE items 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE items 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update shop_inventory table if it exists
UPDATE shop_inventory 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE shop_inventory 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update protocols table
UPDATE protocols 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE protocols 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update subnets table
UPDATE subnets 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE subnets 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Update districts table
UPDATE districts 
SET image_url = CONCAT('https://vectorcoil.com/cx/', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE '/images/%';

UPDATE districts 
SET image_url = CONCAT('https://vectorcoil.com/cx', image_url)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%'
  AND image_url LIKE 'images/%';

-- Verify the updates
SELECT 'gigs' as table_name, COUNT(*) as updated_count 
FROM gigs 
WHERE image_url LIKE 'https://vectorcoil.com/cx/%'
UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts WHERE image_url LIKE 'https://vectorcoil.com/cx/%'
UNION ALL
SELECT 'points_of_interest', COUNT(*) FROM points_of_interest WHERE image_url LIKE 'https://vectorcoil.com/cx/%'
UNION ALL
SELECT 'hardware', COUNT(*) FROM hardware WHERE image_url LIKE 'https://vectorcoil.com/cx/%'
UNION ALL
SELECT 'slimsoft', COUNT(*) FROM slimsoft WHERE image_url LIKE 'https://vectorcoil.com/cx/%'
UNION ALL
SELECT 'items', COUNT(*) FROM items WHERE image_url LIKE 'https://vectorcoil.com/cx/%';
