# Breach Success/Failure System

## Overview
Implemented a comprehensive breach success/failure system for terminal breach actions with dynamic success rates, failure penalties, cooldowns, and encounter triggers.

## Success Rate Calculation

### Formula
```
Base Success Rate: 60%
+ (Decryption / 10)%
+ Interface%
+ (Cache / 20)%
- (Level Disparity × 10)%
- (breach_difficulty × 5)%

Floor: 15%
Cap: 95%
```

### Example Calculations
- **High-level player with good stats**:
  - Decryption: 50 → +5%
  - Interface: 20 → +20%
  - Cache: 40 → +2%
  - Level Disparity: 0 → 0%
  - Breach Difficulty: 3 → -15%
  - **Total: 72% success rate**

- **Low-level player**:
  - Decryption: 10 → +1%
  - Interface: 5 → +5%
  - Cache: 10 → +0.5%
  - Level Disparity: -3 → -30%
  - Breach Difficulty: 3 → -15%
  - **Total: 21.5% success rate**

### Risk Levels
- **Low Risk**: 75%+ (Green)
- **Moderate Risk**: 50-74% (Yellow)
- **High Risk**: 30-49% (Orange)
- **Critical Risk**: <30% (Red)

## Failure Mechanics

### Standard Failure (85% of failures)
- **XP**: 25% of base XP (7-12 XP instead of 30-50)
- **Penalties**:
  - -5 Stamina (extra penalty)
  - -10 Consciousness
  - -5 Charge (extra penalty)
  - +10 Neural Load
  - +10 Thermal Load
- **Cooldown**: 60 minutes on the specific POI
- **No Rewards**: No item discovery or normal encounter triggers

### Critical Failure (15% of failures)
- **Same penalties** as standard failure
- **Additional Effect**: Triggers encounter
  - **Physical Breach** (user at location): Guard encounter
  - **Remote Breach** (user not at location): Hacker encounter
- **Encounter Type**: Based on user's street cred for appropriate difficulty

## Database Changes

### Migration: `add_breach_cooldown.sql`
```sql
ALTER TABLE user_zone_history 
ADD COLUMN cooldown_until DATETIME NULL 
COMMENT 'When breach cooldown expires for failed attempts' 
AFTER result_status;

CREATE INDEX idx_cooldown ON user_zone_history(user_id, poi_id, cooldown_until);
```

## Code Implementation

### Files Modified/Created

1. **`src/lib/game/breachUtils.ts`** (NEW)
   - `calculateBreachSuccessRate()`: Computes success rate with all modifiers
   - `rollBreachSuccess()`: Determines success/failure
   - `rollCriticalFailure()`: 15% chance check
   - `getBreachFailurePenalties()`: Returns penalty object
   - `calculateFailureXP()`: 25% of base XP

2. **`src/app/api/zones/breach/route.ts`** (MODIFIED)
   - Added cooldown check before allowing breach initiation
   - Calculates and returns success rate data for UI display
   - Shows remaining cooldown time in error message

3. **`src/app/api/zones/breach-results/route.ts`** (MODIFIED)
   - Fetches POI breach_difficulty and zone district_level
   - Gets user stats (decryption, interface, cache) and level
   - Calculates success rate and rolls for outcome
   - **Failure Path**:
     - Applies penalties via StatsService
     - Sets 60-minute cooldown
     - Awards 25% XP
     - Marks as 'failed'
     - Rolls for critical failure (15%)
     - Triggers encounter on critical failure
   - **Success Path**:
     - Existing logic (item discovery, encounter roll)
     - Marks as 'completed'

4. **`src/components/ActionResultsSummary.tsx`** (MODIFIED)
   - Added `failed`, `criticalFailure`, and `penalties` props
   - Shows "BREACH FAILED" or "BREACH SUCCESS" title
   - Displays penalty breakdown for failures
   - Color-coded: green for success, red for failure

5. **`src/components/PoiCard.tsx`** (MODIFIED)
   - Passes failure state and penalties to ActionResultsSummary
   - Displays results with appropriate formatting

6. **`src/app/city/[zone]/page.tsx`** (MODIFIED)
   - Added breachSuccessRate state
   - Stores success rate from breach initiation
   - Passes to results display

7. **`database/add_breach_cooldown.sql`** (NEW)
   - Migration script for cooldown tracking

## User Experience

### Before Breach
- User clicks "BREACH" button
- Confirmation modal shows costs and duration
- No risk display in confirmation (calculated during execution)

### During Breach
- 1-hour countdown timer
- "IN PROGRESS" button disabled
- Bandwidth occupied (restored on completion)

### After Completion
- **SUCCESS**:
  - Green "BREACH SUCCESS" header
  - Full XP display (30-50 XP)
  - Possible item discovery (intel only)
  - Possible encounter trigger
  - No cooldown
  
- **FAILURE**:
  - Red "BREACH FAILED" header
  - Reduced XP display (25%)
  - Penalty breakdown shown
  - No item discovery
  - 60-minute cooldown message
  - **Critical Failure**: Additional encounter alert

### Cooldown Display
When cooldown is active:
- "BREACH" button disabled
- Error message: "Terminal on cooldown after failed breach. Try again in X minutes."

## Game Balance

### Encouraging Stat Investment
- **Decryption** increases success rate directly
- **Interface** provides significant boost
- **Cache** provides minor boost
- Leveling up reduces penalties from district level disparity

### Risk/Reward
- High-difficulty terminals reward skilled players
- Low-level players should scout for easier targets
- Remote breaches avoid physical presence requirement but have same failure risk
- Critical failures add tension and danger

### Failure Recovery
- 60-minute cooldown prevents spamming
- Reduced XP still provides some progression
- Penalties create meaningful consequences
- Encounters on critical failure add excitement

## Testing Checklist

- [ ] Run database migration: `add_breach_cooldown.sql`
- [ ] Test successful breach (high success rate)
- [ ] Test failed breach (low success rate)
- [ ] Test critical failure encounter trigger
- [ ] Test physical vs remote breach encounter types
- [ ] Verify cooldown prevents re-breach
- [ ] Verify cooldown expires after 60 minutes
- [ ] Test penalty application to stats
- [ ] Verify XP calculation (25% on failure)
- [ ] Test success rate calculation with various stat combinations
- [ ] Verify results display (success/failure states)
- [ ] Test level up with failure XP

## Future Enhancements

### Potential Additions
1. **Risk Display in Confirmation Modal**
   - Show calculated success rate before confirming
   - Color-coded risk level indicator
   - Requires preview API endpoint or client-side calculation

2. **Breach Stat Tracking**
   - Success/failure rates per terminal
   - Historical success rates per district
   - User breach statistics page

3. **Equipment Modifiers**
   - Arsenal items that boost success rate
   - Decryption tools reduce cooldown
   - Interface mods reduce penalties

4. **Terminal Reputation**
   - Terminals become harder after failures
   - Success streaks provide bonuses
   - Terminal "security level" increases

5. **Notification System**
   - Alert when cooldown expires
   - Notify on critical failures
   - Summary of all active cooldowns

## Notes
- Success rate is calculated server-side to prevent cheating
- Cooldown is per-POI, not global
- Critical failure rate (15%) is fixed, not stat-dependent
- Physical vs remote breach determined by user.location === zone_id
- Bandwidth restored on completion (success or failure)
- Level up check runs after XP award (works with failure XP)
