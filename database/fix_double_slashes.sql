-- Fix double slashes in image URLs (cx//images -> cx/images)
-- Run this to correct the URLs that were concatenated incorrectly

UPDATE gigs 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE contacts 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE points_of_interest 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE hardware 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE slimsoft 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE items 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE shop_inventory 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE protocols 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE subnets 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

UPDATE districts 
SET image_url = REPLACE(image_url, 'cx//images', 'cx/images')
WHERE image_url LIKE '%cx//images%';

-- Verify the fix
SELECT 'Remaining double slashes' as check_name, COUNT(*) as count
FROM (
  SELECT image_url FROM gigs WHERE image_url LIKE '%//%'
  UNION ALL
  SELECT image_url FROM contacts WHERE image_url LIKE '%//%'
  UNION ALL
  SELECT image_url FROM points_of_interest WHERE image_url LIKE '%//%'
  UNION ALL
  SELECT image_url FROM hardware WHERE image_url LIKE '%//%'
  UNION ALL
  SELECT image_url FROM slimsoft WHERE image_url LIKE '%//%'
  UNION ALL
  SELECT image_url FROM items WHERE image_url LIKE '%//%'
) as all_urls;
