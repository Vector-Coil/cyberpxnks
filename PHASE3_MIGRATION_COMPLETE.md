# Phase 3: Max Stats Migration Complete

## Summary
Successfully removed `max_*` columns from the database and migrated all code to use StatsService for dynamic max stat calculations.

## Changes Made

### 1. Database Schema
- **Dropped columns** from `user_stats` table:
  - `max_consciousness`
  - `max_stamina`
  - `max_charge`
  - `max_thermal`
  - `max_neural`
  - `max_bandwidth`

### 2. API Endpoints Migrated to StatsService
All endpoints now calculate max values dynamically instead of querying from database:

✅ **`/api/grid/scan`** - Uses StatsService for `max_bandwidth`, `max_neural`, `max_thermal`
✅ **`/api/zones/breach`** - Uses StatsService for `max_bandwidth`
✅ **`/api/city/explore`** - Uses StatsService for `max_consciousness`, `max_bandwidth`
✅ **`/api/grid/scan-results`** - Uses StatsService.modifyStats() instead of SQL with max_bandwidth
✅ **`/api/stats`** - Already using StatsService (returns calculated max values)

### 3. TypeScript Interfaces Updated
Removed max stat fields from interfaces since they're no longer stored:

✅ **`src/types/common.ts`** - Removed `max_*` fields from `UserStats`
✅ **`src/lib/db.ts`** - Removed `max_*` fields from `UserStatsData`

### 4. Legacy Files Removed
Deleted files that are now replaced by StatsService:

✅ **`src/lib/capStats.ts`** - Replaced by `StatsService.capAtMax()`
✅ **`src/app/api/admin/fix-stats/route.ts`** - No longer needed
✅ **`src/app/api/recalculate-max-stats/route.ts`** - No longer needed
✅ **`src/app/api/stats-v2/route.ts`** - Redundant with `/api/stats`
✅ **`database/fix_max_stats.sql`** - One-time migration script

## Benefits

### Single Source of Truth
- All max values calculated by StatsService using consistent formulas
- No sync issues between stored and calculated values
- Equipment changes automatically reflect in max stats

### Cleaner Architecture
- Database stores only current meter values
- Max values computed on-demand from:
  - User attributes (cognition, power, resilience)
  - Class base stats
  - Equipped hardware modifiers
  - Equipped slimsoft modifiers

### Correct Formulas (Fixed)
- max_consciousness = cognition × resilience
- max_stamina = power × resilience
- max_charge = tech_clock_speed + hw_cell_capacity
- max_thermal = tech_clock_speed + tech_cooling
- max_neural = cognition + resilience + max_bandwidth
- max_bandwidth = floor(((hw_processor + hw_memory) × ((tech_clock_speed + tech_cache) / tech_latency)) / hw_lifi)

All calculations use `Number()` coercion to prevent string concatenation bugs.

## Testing Checklist

Before deploying, verify:
- [ ] `/api/stats?fid=300187` returns correct max values
- [ ] Grid scan action checks max_bandwidth correctly
- [ ] Breach action checks max_bandwidth correctly
- [ ] City explore checks max_consciousness correctly
- [ ] Completing scan restores bandwidth correctly
- [ ] Dashboard meters display correct max values
- [ ] Regeneration caps at correct max values

## Next Steps

**Phase 4 (Optional):** Migrate remaining action endpoints to use StatsService:
- `/api/zones/scout-results`
- `/api/zones/breach-results` 
- `/api/city/explore-results`
- `/api/travel`

These currently use direct SQL UPDATE statements. Migrating them to `StatsService.modifyStats()` would ensure consistent stat handling and automatic capping.

## Rollback Plan

If issues arise, you can restore max columns with:

```sql
ALTER TABLE user_stats 
  ADD COLUMN max_consciousness INT DEFAULT 0,
  ADD COLUMN max_stamina INT DEFAULT 0,
  ADD COLUMN max_charge INT DEFAULT 0,
  ADD COLUMN max_thermal INT DEFAULT 0,
  ADD COLUMN max_neural INT DEFAULT 0,
  ADD COLUMN max_bandwidth INT DEFAULT 0;

-- Then recalculate values using StatsService for each user
```

However, the current implementation should work correctly since StatsService calculates everything dynamically.
