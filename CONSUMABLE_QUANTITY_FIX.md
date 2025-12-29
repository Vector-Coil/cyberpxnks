# Bug Fixes: Consumable Quantities & Arsenal Stat Scaling

## Issue 1: Consumable Quantity Bug

### Problem Description
When using a consumable item from a stack (e.g., x3 quantity), the entire stack was being deleted instead of decrementing by 1. Additionally, the detail page was not summing quantities across multiple inventory rows for the same item.

### Root Causes

**1. Type Coercion Bug in Consumable Use**
The bug was in [src/app/api/consumables/use/route.ts](src/app/api/consumables/use/route.ts) where a type coercion issue caused the quantity check to fail:

```typescript
// BEFORE (BUGGY CODE)
if (inventoryItem.quantity === 1) {
  // Delete entire inventory row
  DELETE FROM user_inventory...
} else {
  // Decrement by 1
  UPDATE user_inventory SET quantity = quantity - 1...
}
```

**The Problem:**
- `inventoryItem.quantity` from the MySQL query is returned as a **string** (e.g., `"3"`)
- The comparison `inventoryItem.quantity === 1` compares string `"3"` to number `1`
- This comparison always returns `false` due to strict type checking
- The code always took the DELETE path, removing the entire stack

**2. Multiple Inventory Rows Not Summed**
The [src/app/api/items/[id]/route.ts](src/app/api/items/[id]/route.ts) endpoint was using `LIMIT 1`, so it only fetched one row instead of summing quantities across all duplicate rows in `user_inventory`.

### Solutions

**File: `src/app/api/consumables/use/route.ts`**

1. **Added quantity parsing and row ID tracking**:
   - Added `ui.id` to SELECT query to track specific inventory rows
   - Declared `currentQuantity` variable with parsed integer value
   - `const currentQuantity = parseInt(inventoryItem.quantity, 10);`

2. **Updated validation and decrement logic**:
   - Changed comparisons to use parsed `currentQuantity`
   - Updated DELETE/UPDATE to target specific row by `id` instead of user_id + item_id
   - Handles duplicate inventory rows by consuming from oldest first (ORDER BY acquired_at)

3. **Enhanced logging**:
   - Added `inventoryRowId`, `quantityRaw`, `quantityParsed`, and `quantityType` to logger
   - Helps diagnose type-related issues in the future

**File: `src/app/api/items/[id]/route.ts`**

1. **Changed query to SUM quantities**:
   ```sql
   SELECT 
     SUM(quantity) as quantity, 
     MIN(acquired_at) as acquired_at, 
     MAX(upgrade) as upgrade
   FROM user_inventory
   WHERE user_id = ? AND item_id = ?
   GROUP BY user_id, item_id
   ```
   - Now properly sums all duplicate rows
   - Detail page shows correct total quantity (e.g., x3 instead of x1)

---

## Issue 2: Arsenal Equipment Stat Scaling

### Problem Description
When equipping or unequipping arsenal items that modify max stat values (Consciousness, Stamina, Charge, Thermal Load, Neural Load), current meter values were not scaling proportionally:

**Examples:**
- At 48/48 Charge, unequipping Energy Cells → 48/38 (should be 38/38)
- At 25/38 Charge, equipping Energy Cells → 25/48 (should be ~32/48 to maintain same %)
- Similar issues with Consciousness, Stamina, and inverse scaling for Thermal/Neural Load

### Root Cause
The arsenal equip/unequip logic in [src/app/api/hardware/equip/route.ts](src/app/api/hardware/equip/route.ts) was not capturing old max values or calling proportional scaling like the cyberdeck equip logic did.

### Solution

**File: `src/app/api/hardware/equip/route.ts`**

1. **Arsenal Equip** (Lines ~505-595):
   - ✅ Added: Capture old max values BEFORE equipping
   - ✅ Added: Call `statsService.scaleCurrentOnEquip(oldMaxValues)` after updating stats
   - ✅ Now proportionally scales consciousness, stamina, charge, bandwidth, thermal, neural

2. **Arsenal Unequip** (Lines ~306):
   - ✅ Added: Capture old max values BEFORE unequipping
   - ✅ Added: Call `statsService.scaleCurrentOnEquip(oldMaxValues)` after updating stats
   - ✅ Replaces simple `capAtMax()` with proper proportional scaling

**File: `src/lib/statsService.ts`**

1. **Updated `scaleCurrentOnEquip` method** (Lines ~620-705):
   - ✅ Extended signature to accept `thermal?` and `neural?` in oldMaxValues
   - ✅ Added `calculateInverseScaled()` helper for thermal/neural
   - ✅ Queries and updates current_thermal and current_neural
   - ✅ Maintains same "usage percentage" for inverse meters

**Scaling Logic:**

```typescript
// Standard meters (Consciousness, Stamina, Charge, Bandwidth)
// If at 25/38, equipping item that adds +10 max → 32/48 (same 65.7%)
const proportion = currentVal / oldMax;
const newCurrent = Math.ceil(proportion * newMax);

// Inverse meters (Thermal, Neural)
// If at 20/50 thermal (40% used), max goes to 60 → 24/60 (still 40% used)
const proportion = currentVal / oldMax;
const newCurrent = Math.floor(proportion * newMax);
```

### Testing Recommendations

**Consumables:**
1. Purchase/acquire 3+ of the same consumable
2. Verify detail page shows correct total (e.g., "x3")
3. Use 1 item → verify decrements to x2 (not deleted)
4. Use another → verify decrements to x1
5. Use final item → verify it's removed from inventory

**Arsenal Stats:**
1. Note current stats (e.g., 25/38 Charge)
2. Equip arsenal item with +10 Charge modifier
3. Verify current scales proportionally (should be ~32/48, not 25/48)
4. Unequip arsenal item
5. Verify current scales back proportionally (should be 25/38, not 32/38)
6. Test with Thermal/Neural Load (inverse scaling)

## Related Files

### Consumable System
- [src/app/gear/[item]/page.tsx](src/app/gear/[item]/page.tsx) - Item detail page that displays quantity
- [src/app/api/items/[id]/route.ts](src/app/api/items/[id]/route.ts) - Fetches item data with quantity
- [src/app/api/consumables/use/route.ts](src/app/api/consumables/use/route.ts) - Handles consumable usage
- [src/app/api/shops/purchase/route.ts](src/app/api/shops/purchase/route.ts) - Adds items to inventory

### Arsenal System
- [src/app/api/hardware/equip/route.ts](src/app/api/hardware/equip/route.ts) - Handles all equipment operations
- [src/lib/statsService.ts](src/lib/statsService.ts) - Centralized stats calculation and scaling
- [database/add_combat_stats.sql](database/add_combat_stats.sql) - Arsenal modifiers schema

## Database Schema Reference

```sql
-- user_inventory table structure
CREATE TABLE user_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  upgrade INT DEFAULT 0,
  UNIQUE KEY unique_user_item (user_id, item_id)
);

-- arsenal_modifiers table structure
CREATE TABLE arsenal_modifiers (
  item_id INT PRIMARY KEY,
  consciousness INT DEFAULT 0 NOT NULL,
  stamina INT DEFAULT 0 NOT NULL,
  charge INT DEFAULT 0 NOT NULL,
  neural INT DEFAULT 0 NOT NULL,
  thermal INT DEFAULT 0 NOT NULL,
  tactical INT DEFAULT 0 NOT NULL,
  smart_tech INT DEFAULT 0 NOT NULL,
  offense INT DEFAULT 0 NOT NULL,
  defense INT DEFAULT 0 NOT NULL,
  evasion INT DEFAULT 0 NOT NULL,
  stealth INT DEFAULT 0 NOT NULL,
  discovery_zone INT DEFAULT 0 NOT NULL,
  discovery_item INT DEFAULT 0 NOT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

## Status
✅ **FIXED** - Consumables now correctly decrement by 1 instead of deleting entire stack
✅ **FIXED** - Item detail page now sums quantities across duplicate inventory rows  
✅ **FIXED** - Arsenal equipment now properly scales current meter values proportionally
✅ **FIXED** - Thermal and Neural Load now scale inversely when arsenal is equipped/unequipped
