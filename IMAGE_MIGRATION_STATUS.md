# Image CDN Migration - Verification Steps

## What We Fixed

1. **NavDrawer on District Page** ✅
   - Added NavDrawer import and state
   - Added NavDrawer component to all return states (loading, error, main)
   - Added `onMenuClick` handler to NavStrip

2. **Gear Page Tabs** ✅  
   - Changed from `flex gap-2` to `flex flex-wrap gap-2` (allows wrapping)
   - Reduced padding: `py-3 px-4` → `py-2 px-3`
   - Reduced font size: `text-sm` → `text-xs`
   - Added `min-w-[80px]` to prevent tabs from becoming too small

## What Still Needs Verification

### Images Not Displaying

**Root Cause**: Database still has old paths like `/images/...` instead of CDN URLs

**Fix Required**: Run the SQL scripts (if you haven't already):

```bash
# Fix the double slashes first
mysql -u your_user -p your_database < database/fix_double_slashes.sql

# Verify images are using CDN URLs
```

**Check if images are fixed**:
- Contact images: Should show on /contacts and /contacts/[id] pages
- City zone images: Should show on /city and /city/[zone] pages
- District zone images: Should show on /city/district/[id] page

### Manual Verification Checklist

- [ ] Run `fix_double_slashes.sql` on the database
- [ ] Check a few image URLs in database:
  ```sql
  SELECT image_url FROM gigs LIMIT 5;
  SELECT image_url FROM contacts LIMIT 5;
  SELECT image_url FROM points_of_interest LIMIT 5;
  ```
  All should start with `https://vectorcoil.com/cx/images/`

- [ ] Verify images load on:
  - [ ] /contacts page (contact avatar images)
  - [ ] /contacts/[id] page (contact avatar + gig images)
  - [ ] /city page (zone background images)
  - [ ] /city/[zone] page (zone detail image)
  - [ ] /city/district/[id] page (zone images in district)

- [ ] Test NavDrawer on /city/district/[id] page

- [ ] Test Gear page tabs on mobile (should wrap nicely)

## If Images Still Don't Appear

Check browser console for 404 errors. If you see:
- `https://vectorcoil.com/cx//images/...` (double slash) → Run fix_double_slashes.sql
- `/images/...` (relative path) → Database wasn't updated, run update_image_urls_to_cdn.sql
- CORS errors → Add CORS headers to your web hosting for vectorcoil.com

## Hardcoded Images That Were Fixed

These were updated to use CDN directly in code:
- Hardware page empty slot: `/images/soft_new.png` → CDN URL
- Frame images in db.ts (frame1-4.png) → CDN URLs

All other images come from the database, so fixing the database is the key.
