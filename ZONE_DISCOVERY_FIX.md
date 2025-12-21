# Zone Discovery Fix & Recommendations

## Issue Identified

### Root Cause
The zone discovery system was **completely broken** due to a data type mismatch:

**Problem:** Query used `WHERE zd.active = true` (boolean comparison)  
**Reality:** Database stores `active` as VARCHAR with string values: `"true"`, `"yes"`, `"false"`  
**Result:** Query always returned 0 zones, even though 33 undiscovered zones were available

### Impact
- User completed multiple City Explore actions
- Even when rolling "discovery" reward (28.6% chance), no zones were discovered
- User only received base +75 XP without any zone unlocks

## Fix Applied

Updated query in `src/app/api/city/explore-results/route.ts`:

```typescript
// OLD (BROKEN):
WHERE zd.active = true

// NEW (FIXED):
WHERE zd.active IN ('true', 'yes', 'TRUE', 'YES', 1)
```

This now correctly matches the string values stored in the database.

## Current State

**Database:**
- **185 total zones** across 20 districts
- **4 active districts:**
  - Old Town Sector (10 zones)
  - Central Sprawl (10 zones)
  - The Annex (10 zones)
  - Selica City Center (5 zones)

**User Progress:**
- Discovered: **2 zones** (The Crossroads, The Loop - both in The Annex)
- Available: **33 undiscovered zones** in active districts

**Probability:**
- 28.6% chance per City Explore to roll "discovery"
- When discovery rolls, system now picks random undiscovered zone from active districts

## Recommendations

### 1. **Normalize District Active Field** ⭐ HIGH PRIORITY

**Issue:** Inconsistent values (`"true"`, `"yes"`, `"false"`)  
**Solution:** Standardize to proper BOOLEAN or consistent VARCHAR

#### Option A: Convert to Boolean (Recommended)
```sql
-- Backup first
CREATE TABLE zone_districts_backup AS SELECT * FROM zone_districts;

-- Alter column to TINYINT (MySQL boolean)
ALTER TABLE zone_districts MODIFY COLUMN active TINYINT(1) DEFAULT 0;

-- Update values
UPDATE zone_districts SET active = 1 WHERE active IN ('true', 'yes', 'TRUE', 'YES', '1');
UPDATE zone_districts SET active = 0 WHERE active IN ('false', 'FALSE', '0');

-- Update all queries to use boolean comparison
WHERE zd.active = 1  -- or WHERE zd.active IS TRUE
```

#### Option B: Standardize to VARCHAR
```sql
-- Standardize all values to lowercase 'true'/'false'
UPDATE zone_districts SET active = 'true' WHERE active IN ('true', 'yes', 'TRUE', 'YES', '1', 1);
UPDATE zone_districts SET active = 'false' WHERE active IN ('false', 'FALSE', '0', 0);

-- Update queries consistently
WHERE zd.active = 'true'
```

### 2. **Adjust Discovery Probability**

**Current:** 28.6% chance per explore  
**With 33 zones available:** Expected ~3-4 explores per discovery

**Options:**
- **Keep 28.6%**: Reasonable for early game with many zones
- **Increase to 40-50%**: Faster progression, more exciting early game
- **Decrease to 15-20%**: Slower, more deliberate exploration
- **Dynamic scaling**: Higher chance when few zones discovered, lower when many found

#### Implement Dynamic Scaling:
```typescript
// In encounterUtils.ts
export function rollEncounterReward(discoveredCount: number, totalAvailable: number): EncounterRewardType {
  const roll = Math.random() * 100;
  
  // Calculate discovery chance based on progress
  const progressRatio = discoveredCount / (discoveredCount + totalAvailable);
  let discoveryChance = 28.6; // base
  
  if (progressRatio < 0.25) {
    discoveryChance = 40; // Early game: 40%
  } else if (progressRatio < 0.50) {
    discoveryChance = 28.6; // Mid game: 28.6%
  } else if (progressRatio < 0.75) {
    discoveryChance = 20; // Late game: 20%
  } else {
    discoveryChance = 10; // Final zones: 10%
  }
  
  if (roll < 35.7) return 'nothing';
  if (roll < 35.7 + discoveryChance) return 'discovery';
  return 'encounter';
}
```

### 3. **Add Discovery Logging** ⭐ DEBUGGING

Currently no console logs when discovery rolls but finds no zones. Add:

```typescript
if (rewardType === 'discovery') {
  logger.debug('Discovery rolled', { userId, fid });
  
  const [undiscoveredZonesRows] = await dbPool.query<RowDataPacket[]>(/* ... */);
  
  logger.info('Zone discovery query result', { 
    userId, 
    fid, 
    zonesFound: undiscoveredZonesRows.length 
  });
  
  if (undiscoveredZonesRows.length > 0) {
    discoveredZone = undiscoveredZonesRows[0];
    logger.info('Zone discovered', { 
      userId, 
      zoneName: discoveredZone.name,
      zoneId: discoveredZone.id 
    });
    // ... rest of discovery logic
  } else {
    logger.warn('Discovery rolled but no zones available', { userId, fid });
  }
}
```

### 4. **District Activation Strategy**

**Current:** 4 of 20 districts active (20%)  
**33 zones available** for discovery

**Recommendations:**

#### Progressive Unlock System
```typescript
// Unlock districts based on user level/progress
async function checkDistrictUnlocks(userId: number, userLevel: number) {
  const unlockSchedule = {
    1: ['The Annex'], // Starter district
    3: ['Old Town Sector'],
    5: ['Central Sprawl'],
    8: ['Selica City Center'],
    10: ['Northauer'],
    12: ['South Strand'],
    // ... etc
  };
  
  // Activate districts when user reaches level threshold
}
```

#### Story-Driven Unlocks
- Tie district unlocks to quest/mission completion
- Require certain contacts to be met
- Unlock via specific items or achievements

### 5. **Zone Discovery Feedback** ⭐ UX

Enhance the discovery experience:

#### Visual Notifications
```typescript
// In explore results
if (discoveredZone) {
  gainsText += `, 🗺️ Discovered ${discoveredZone.name}`;
  
  // Add special notification
  await createNotification(userId, {
    type: 'zone_discovery',
    title: 'New Zone Unlocked!',
    message: `You've discovered ${discoveredZone.name} in ${districtName}`,
    imageUrl: discoveredZone.image_url,
    actionUrl: `/city?district=${discoveredZone.district}`
  });
}
```

#### Zone Preview
- Show zone image in results
- Display zone description/lore
- Indicate number of POIs (terminals/shops) in zone
- Show zone difficulty/level requirement

### 6. **Balance Zone Distribution**

**Current Distribution:**
- Most districts: 10 zones each
- Selica City Center: 5 zones (smaller area?)
- Vantage Point: 0 zones (empty district)

**Recommendations:**
- Fill Vantage Point with zones or remove from districts
- Consider zone density based on district importance
- Ensure all active districts have meaningful content

### 7. **Add Zone Discovery Cooldown** (Optional)

Prevent rapid zone unlocking:

```typescript
// Only allow zone discovery if user hasn't discovered one recently
const [recentDiscovery] = await dbPool.query(
  `SELECT MAX(timestamp) as last_discovery
   FROM user_zone_history
   WHERE user_id = ? AND action_type = 'Discovered'`,
  [userId]
);

const lastDiscovery = recentDiscovery[0]?.last_discovery;
const hoursSinceDiscovery = lastDiscovery 
  ? (Date.now() - new Date(lastDiscovery).getTime()) / (1000 * 60 * 60)
  : 999;

if (rewardType === 'discovery' && hoursSinceDiscovery < 2) {
  // Too soon, convert to encounter or nothing
  rewardType = Math.random() < 0.5 ? 'encounter' : 'nothing';
}
```

## Testing Validation

To verify the fix works:

```bash
# Run diagnostic
node scripts/check-user-zones.mjs

# Should show:
# - User discovered: 2 zones
# - Undiscovered zones available: 33
# - Sample zones listed

# Test in-game:
# 1. Complete City Explore actions
# 2. ~28.6% should result in zone discovery
# 3. Check gainsText includes "Discovered [Zone Name]"
# 4. Verify zone appears in user's zone list
```

## Database Schema Recommendation

For future consistency, create migration:

```sql
-- database/normalize_district_active.sql

-- Backup table
CREATE TABLE zone_districts_backup_20251220 AS SELECT * FROM zone_districts;

-- Convert to proper boolean
ALTER TABLE zone_districts 
  MODIFY COLUMN active TINYINT(1) NOT NULL DEFAULT 0 
  COMMENT 'District active status (0=inactive, 1=active)';

-- Normalize existing data
UPDATE zone_districts 
SET active = CASE 
  WHEN active IN ('true', 'yes', 'TRUE', 'YES', '1', 1) THEN 1
  ELSE 0
END;

-- Add index for performance
CREATE INDEX idx_district_active ON zone_districts(active);
```

## Reusable Pattern for Other Features

This same active field issue might exist elsewhere. Check:

```bash
# Search for similar patterns
grep -r "active = true" src/app/api/
grep -r "active = false" src/app/api/
grep -r ".active" src/app/api/ | grep WHERE
```

**Other tables to audit:**
- `subnets` (if has active field)
- `encounters` (if has active field)
- `shops` (if has active field)
- Any other entity with enable/disable flags

## Summary

✅ **Fixed:** Zone discovery now works correctly (string comparison instead of boolean)  
⭐ **Priority:** Normalize `active` field to proper boolean type  
🎯 **Optional:** Dynamic discovery probability based on progress  
📊 **Monitor:** Log discovery attempts and results for tuning  
🎨 **Enhance:** Add better visual feedback for zone discoveries  

The fix is now deployed and zone discovery should work on the next City Explore action!
