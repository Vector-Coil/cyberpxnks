-- Fix image paths to include proper subfolders
-- Contact images need /contacts/ subfolder
-- Gig images need /gigs/ subfolder
-- etc.

-- Fix contacts table - add /contacts/ subfolder
UPDATE contacts 
SET image_url = REPLACE(image_url, '/images/contact_', '/images/contacts/contact_')
WHERE image_url LIKE '%/images/contact_%';

-- Fix gigs table - add /gigs/ subfolder
UPDATE gigs 
SET image_url = REPLACE(image_url, '/images/gig_', '/images/gigs/gig_')
WHERE image_url LIKE '%/images/gig_%';

-- Verify the fixes
SELECT 'contacts' as table_name, image_url as sample_url 
FROM contacts 
WHERE image_url IS NOT NULL 
LIMIT 3;

SELECT 'gigs' as table_name, image_url as sample_url 
FROM gigs 
WHERE image_url IS NOT NULL 
LIMIT 3;

SELECT 'points_of_interest' as table_name, image_url as sample_url 
FROM points_of_interest 
WHERE image_url IS NOT NULL 
LIMIT 3;
