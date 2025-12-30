# Breach System Deployment Guide

## Quick Start

### 1. Run Database Migration
Execute the cooldown tracking migration:

```bash
# Connect to your MySQL database
mysql -u [username] -p [database_name] < database/add_breach_cooldown.sql
```

Or via MySQL client:
```sql
SOURCE database/add_breach_cooldown.sql;
```

### 2. Verify Migration
Check that the column was added:

```sql
DESCRIBE user_zone_history;
-- Should show 'cooldown_until' column (DATETIME NULL)

SHOW INDEX FROM user_zone_history WHERE Key_name = 'idx_cooldown';
-- Should show the cooldown index
```

### 3. Test the System
1. **Test Success**:
   - Find a terminal with low breach_difficulty
   - Start breach with high Decryption stats
   - Complete and verify success message

2. **Test Failure**:
   - Find a terminal with high breach_difficulty
   - Start breach with low stats
   - Verify failure penalties and cooldown

3. **Test Cooldown**:
   - After a failure, try to breach same terminal immediately
   - Should see: "Terminal on cooldown after failed breach. Try again in X minutes."

4. **Test Critical Failure**:
   - Repeat failures until you get a critical failure (15% chance)
   - Verify encounter is triggered
   - Physical breach should trigger city encounter
   - Remote breach should trigger overnet encounter

## File Changes Summary

### New Files
- `src/lib/game/breachUtils.ts` - Success rate calculations and utilities
- `database/add_breach_cooldown.sql` - Database migration
- `BREACH_SUCCESS_FAILURE_SYSTEM.md` - Complete documentation

### Modified Files
- `src/app/api/zones/breach/route.ts` - Cooldown check and success rate
- `src/app/api/zones/breach-results/route.ts` - Success/failure logic
- `src/components/ActionResultsSummary.tsx` - Failure state display
- `src/components/PoiCard.tsx` - Pass failure props
- `src/app/city/[zone]/page.tsx` - Store success rate state

## Rollback (if needed)

To revert the database changes:

```sql
-- Remove the cooldown column
ALTER TABLE user_zone_history DROP COLUMN cooldown_until;

-- Remove the index
DROP INDEX idx_cooldown ON user_zone_history;
```

Then revert the code changes via git:
```bash
git checkout HEAD -- src/lib/game/breachUtils.ts
git checkout HEAD -- src/app/api/zones/breach/route.ts
git checkout HEAD -- src/app/api/zones/breach-results/route.ts
git checkout HEAD -- src/components/ActionResultsSummary.tsx
git checkout HEAD -- src/components/PoiCard.tsx
git checkout HEAD -- src/app/city/[zone]/page.tsx
```

## Monitoring

### Check for Failed Breaches
```sql
SELECT 
  uzh.id,
  u.username,
  poi.name as terminal_name,
  uzh.result_status,
  uzh.xp_data,
  uzh.cooldown_until,
  uzh.timestamp
FROM user_zone_history uzh
JOIN users u ON uzh.user_id = u.id
LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
WHERE uzh.action_type IN ('Breached', 'RemoteBreach')
  AND uzh.result_status = 'failed'
ORDER BY uzh.timestamp DESC
LIMIT 20;
```

### Check Active Cooldowns
```sql
SELECT 
  u.username,
  poi.name as terminal_name,
  uzh.cooldown_until,
  TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), uzh.cooldown_until) as minutes_remaining
FROM user_zone_history uzh
JOIN users u ON uzh.user_id = u.id
LEFT JOIN points_of_interest poi ON uzh.poi_id = poi.id
WHERE uzh.cooldown_until > UTC_TIMESTAMP()
ORDER BY uzh.cooldown_until ASC;
```

### Check Success Rates by Terminal
```sql
SELECT 
  poi.name,
  poi.breach_difficulty,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN uzh.result_status = 'completed' THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN uzh.result_status = 'failed' THEN 1 ELSE 0 END) as failures,
  ROUND(100.0 * SUM(CASE WHEN uzh.result_status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_pct
FROM user_zone_history uzh
JOIN points_of_interest poi ON uzh.poi_id = poi.id
WHERE uzh.action_type IN ('Breached', 'RemoteBreach')
  AND uzh.result_status IN ('completed', 'failed')
GROUP BY poi.id, poi.name, poi.breach_difficulty
HAVING total_attempts >= 5
ORDER BY success_rate_pct ASC;
```

## Configuration

### Adjusting Success Rate Parameters
Edit `src/lib/game/breachUtils.ts`:

```typescript
// Base rate (currently 60%)
let successRate = 60;

// Stat bonuses (adjust multipliers)
successRate += params.decryption / 10;  // Change denominator for different impact
successRate += params.interfaceStat;    // 1:1 ratio
successRate += params.cache / 20;       // Change denominator

// Level penalty (currently 10% per level)
successRate -= levelDisparity * 10;     // Adjust multiplier

// Difficulty penalty (currently 5% per point)
successRate -= breachDifficulty * 5;    // Adjust multiplier

// Floor and cap (currently 15% and 95%)
return Math.max(15, Math.min(95, successRate));
```

### Adjusting Failure Penalties
Edit `src/lib/game/breachUtils.ts`:

```typescript
export function getBreachFailurePenalties() {
  return {
    stamina: -5,        // Adjust amounts
    consciousness: -10,
    charge: -5,
    neural: 10,         // Positive = increase load
    thermal: 10
  };
}
```

### Adjusting Cooldown Duration
Edit `src/app/api/zones/breach-results/route.ts`:

```typescript
// Currently 60 minutes
const cooldownUntil = new Date(Date.now() + 60 * 60 * 1000);

// Change to 30 minutes:
const cooldownUntil = new Date(Date.now() + 30 * 60 * 1000);
```

### Adjusting Critical Failure Rate
Edit `src/lib/game/breachUtils.ts`:

```typescript
// Currently 15%
export function rollCriticalFailure(): boolean {
  return Math.random() < 0.15;  // Change 0.15 to desired rate
}
```

### Adjusting Failure XP Percentage
Edit `src/lib/game/breachUtils.ts`:

```typescript
// Currently 25%
export function calculateFailureXP(baseXp: number): number {
  return Math.floor(baseXp * 0.25);  // Change 0.25 to desired percentage
}
```

## Troubleshooting

### Issue: Cooldown not preventing breach
**Solution**: Verify migration ran successfully and check index exists.

### Issue: Success rate seems wrong
**Solution**: Check user stats query in breach-results API, verify COALESCE for district level.

### Issue: Penalties not applying
**Solution**: Check StatsService.modifyStats() is being called and stats are saved.

### Issue: Encounter not triggering on critical failure
**Solution**: Verify getRandomEncounter() returns valid encounters, check street cred filtering.

### Issue: XP calculation incorrect
**Solution**: Verify calculateFailureXP() multiplies correctly, check xp_data field in database.

## Performance Considerations

The success rate calculation involves:
1. Fetching POI details (indexed)
2. Fetching zone/district level (indexed)
3. Fetching user stats via StatsService (cached)
4. Mathematical calculation (fast)

Total added latency: ~10-20ms

The cooldown check involves:
1. Single indexed query on (user_id, poi_id, cooldown_until)
2. Date comparison

Total added latency: ~5-10ms

Both are negligible for the breach flow.
