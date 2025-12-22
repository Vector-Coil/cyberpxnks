-- Update class image URLs to CDN
-- Classes images are now at: http://vectorcoil.com/cx/images/

UPDATE classes 
SET image_url = CONCAT('http://vectorcoil.com/cx/images/', 
  CASE 
    WHEN image_url LIKE '%/%' THEN SUBSTRING_INDEX(image_url, '/', -1)
    ELSE image_url
  END
)
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http://vectorcoil.com/cx/images/%'
  AND image_url NOT LIKE 'https://vectorcoil.com/cx/images/%';

-- Verify the updates
SELECT id, name, image_url FROM classes;
