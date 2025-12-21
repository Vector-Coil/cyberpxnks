-- Update zone image URLs from local paths to CDN
-- Changes /images/City_-_*.png to https://vectorcoil.com/cx/images/city-maps/City_-_*.png

UPDATE zones
SET image_url = REPLACE(image_url, '/images/', 'https://vectorcoil.com/cx/images/city-maps/')
WHERE image_url LIKE '/images/City_%';

-- Verify results
SELECT 
  COUNT(CASE WHEN image_url LIKE '/images/%' THEN 1 END) as old_format,
  COUNT(CASE WHEN image_url LIKE 'https://vectorcoil.com/%' THEN 1 END) as new_format
FROM zones;
