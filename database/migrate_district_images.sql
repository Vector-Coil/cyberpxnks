-- Migrate images from zones table to zone_districts table
-- Each district gets the image from the first zone in that district

-- Step 1: Update zone_districts.image_url by concatenating CDN URL with zones.image_url
UPDATE zone_districts zd
INNER JOIN (
  SELECT 
    z.district,
    MIN(z.id) as first_zone_id
  FROM zones z
  WHERE z.image_url IS NOT NULL AND z.image_url != ''
  GROUP BY z.district
) first_zones ON zd.id = first_zones.district
INNER JOIN zones z ON z.id = first_zones.first_zone_id
SET zd.image_url = CONCAT('https://vectorcoil.com/cx', z.image_url)
WHERE zd.image_url IS NULL OR zd.image_url = '';

-- Step 2: Verify the migration
SELECT 
  zd.id,
  zd.name as district_name,
  zd.image_url as district_image,
  COUNT(z.id) as zone_count
FROM zone_districts zd
LEFT JOIN zones z ON z.district = zd.id
GROUP BY zd.id, zd.name, zd.image_url
ORDER BY zd.name;

-- Step 3: Show any districts that still don't have images
SELECT 
  zd.id,
  zd.name,
  COUNT(z.id) as zone_count
FROM zone_districts zd
LEFT JOIN zones z ON z.district = zd.id
WHERE zd.image_url IS NULL OR zd.image_url = ''
GROUP BY zd.id, zd.name
ORDER BY zd.name;
