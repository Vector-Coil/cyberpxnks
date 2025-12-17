# Combat Stats System

## Overview

The Combat Stats system introduces 6 new character attributes that affect combat encounters, stealth operations, and tactical decisions in the game. These stats follow a similar pattern to the Tech Stats system but are modified by equipped Arsenal items instead of hardware/slimsoft.

## Combat Stats

### 1. Tactical (TAC)
- **Description**: Strategic thinking and combat planning ability
- **Usage**: Affects combat initiative, tactical options availability, and mission planning
- **Modified By**: Arsenal items (weapons, armor, tactical gear)

### 2. Smart Tech (SMT)
- **Description**: Ability to interface with and utilize smart weapons and systems
- **Usage**: Required for advanced weapon features, targeting systems, smart ammunition
- **Modified By**: Arsenal items (smart weapons, targeting systems)

### 3. Offense (OFF)
- **Description**: Direct combat capability and damage output
- **Usage**: Determines base damage, critical hit chance, offensive options
- **Modified By**: Arsenal items (weapons, damage boosters)

### 4. Defense (DEF)
- **Description**: Damage mitigation and resilience in combat
- **Usage**: Reduces incoming damage, increases survival chance
- **Modified By**: Arsenal items (armor, shields, defensive gear)

### 5. Evasion (EVN)
- **Description**: Ability to avoid attacks and detection
- **Usage**: Dodge chance, reduces hit chance of enemies, stealth movement
- **Modified By**: Arsenal items (light armor, stealth augments)

### 6. Stealth (STH)
- **Description**: Ability to remain undetected and operate covertly
- **Usage**: Detection avoidance, silent takedowns, infiltration success
- **Modified By**: Arsenal items (stealth gear, cloaking devices)

## System Architecture

### Database Schema

#### Classes Table
Each class has base combat stat values:
- `class_tac` - Base Tactical value for this class
- `class_smt` - Base Smart Tech value for this class
- `class_off` - Base Offense value for this class
- `class_def` - Base Defense value for this class
- `class_evn` - Base Evasion value for this class
- `class_sth` - Base Stealth value for this class

#### User_Stats Table
Each user has 3 columns per combat stat (18 total):
- `base_[stat]` - Base value from class (can be upgraded)
- `mod_[stat]` - Modifier from equipped arsenal items
- `total_[stat]` - Final calculated value (base + mod)

Example:
- `base_tac`, `mod_tac`, `total_tac`
- `base_smt`, `mod_smt`, `total_smt`
- etc.

#### Arsenal_Modifiers Table
Stores combat stat bonuses for each arsenal item:

```sql
CREATE TABLE arsenal_modifiers (
  item_id INT PRIMARY KEY,
  tactical INT DEFAULT 0 NOT NULL,
  smart_tech INT DEFAULT 0 NOT NULL,
  offense INT DEFAULT 0 NOT NULL,
  defense INT DEFAULT 0 NOT NULL,
  evasion INT DEFAULT 0 NOT NULL,
  stealth INT DEFAULT 0 NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

### Code Implementation

#### StatsService Interface

```typescript
export interface CombatStats {
  tactical: number;
  smart_tech: number;
  offense: number;
  defense: number;
  evasion: number;
  stealth: number;
}

export interface CompleteStats {
  current: CurrentStats;
  max: MaxStats;
  tech: TechStats;
  combat: CombatStats;  // New combat stats
  attributes: UserAttributes;
  hardware: HardwareModifiers;
  slimsoft: SlimsoftModifiers;
  lastRegeneration: Date | null;
  updatedAt: Date | null;
}
```

#### updateCombatStats Function

Located in `/src/app/api/hardware/equip/route.ts`:

```typescript
async function updateCombatStats(pool: any, userId: number) {
  // 1. Get all equipped arsenal item modifiers
  // 2. Sum modifiers by stat type
  // 3. Get base values from user_stats
  // 4. Calculate totals (base + mods)
  // 5. Update user_stats with mods and totals
}
```

This function is called:
- After equipping an arsenal item
- After unequipping an arsenal item

#### StatsService.getStats()

The `getStats()` method fetches and returns combat stats:

```typescript
const combat: CombatStats = {
  tactical: stats.total_tac || 0,
  smart_tech: stats.total_smt || 0,
  offense: stats.total_off || 0,
  defense: stats.total_def || 0,
  evasion: stats.total_evn || 0,
  stealth: stats.total_sth || 0
};
```

## Arsenal System Integration

### Arsenal Slots
Number of arsenal slots is calculated based on Power attribute:
```typescript
const maxArsenalSlots = Math.max(1, Math.floor(Math.floor(power / 2) - 2));
```

### Equip/Unequip Flow

**When equipping arsenal item:**
1. Verify user owns the item
2. Check available slots (based on Power)
3. Check if item already equipped
4. Find first available slot (arsenal_1, arsenal_2, etc.)
5. Insert into user_loadout
6. **Call updateCombatStats()** to recalculate modifiers
7. Log activity

**When unequipping arsenal item:**
1. Delete from user_loadout
2. **Call updateCombatStats()** to recalculate modifiers
3. Log activity

## Migration & Setup

### 1. Database Migration
Run `database/add_combat_stats.sql`:
- Adds 18 columns to user_stats table
- Creates arsenal_modifiers table
- Adds 6 columns to classes table
- Creates indexes

### 2. Update Class Combat Stats
Update the classes table with appropriate base values for each class:
```sql
UPDATE classes SET 
  class_tac = 10, class_smt = 8, class_off = 12,
  class_def = 6, class_evn = 5, class_sth = 7
WHERE id = 1; -- Example for class 1
```

### 3. Initialize Existing Users
Run `scripts/initializeCombatStats.ts`:
```bash
npx tsx scripts/initializeCombatStats.ts
```

This copies class combat stats to all existing users' user_stats records.

### 4. Populate Arsenal Modifiers
Add combat stat bonuses to arsenal items:
```sql
INSERT INTO arsenal_modifiers (item_id, tactical, offense, defense) 
VALUES (101, 5, 10, 3); -- Example: Assault Rifle
```

## Usage in Game Logic

### Accessing Combat Stats

```typescript
import { StatsService } from '@/lib/statsService';

const pool = await getDbPool();
const statsService = new StatsService(pool, userId);
const stats = await statsService.getStats();

// Access combat stats
const tactical = stats.combat.tactical;
const offense = stats.combat.offense;
// etc.
```

### Future Integration Points

Combat stats can be used in:
- **Encounter System**: Determine combat outcomes, damage calculations
- **Stealth Mechanics**: Check detection, silent movement success
- **Tactical Options**: Unlock special combat moves based on tactical stat
- **Smart Weapons**: Require minimum smart_tech to use effectively
- **Armor Effectiveness**: Defense stat reduces incoming damage
- **Dodge Mechanics**: Evasion determines dodge chance

## Testing

After implementation, verify:
1. ✅ Stats are initialized correctly from class values
2. ✅ Equipping arsenal item updates combat stats
3. ✅ Unequipping arsenal item updates combat stats
4. ✅ Multiple arsenal items stack modifiers correctly
5. ✅ Stats are accessible via StatsService.getStats()
6. ✅ Stats display correctly in UI (when implemented)

## File Locations

- **Migration**: `/database/add_combat_stats.sql`
- **Initialization Script**: `/scripts/initializeCombatStats.ts`
- **Stats Service**: `/src/lib/statsService.ts`
- **Equip Route**: `/src/app/api/hardware/equip/route.ts`
- **Documentation**: `/COMBAT_STATS.md`
