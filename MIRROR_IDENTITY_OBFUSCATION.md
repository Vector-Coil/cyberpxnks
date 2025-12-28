# Mirror Slimsoft Identity Obfuscation System

## Overview
The Mirror slimsoft (item ID 68) enables identity obfuscation by replacing usernames with mirror names in all public activity logs when equipped. This passive feature protects user privacy in public feeds without affecting their actual identity.

## Implementation Details

### Database Schema
- **users.mirror_name**: VARCHAR field storing the unique obfuscated identity
- **user_loadout**: Tracks equipped items including slimsoft with `slot_type='slimsoft'`
- **Item ID 68**: The Mirror slimsoft item

### Core Functionality

#### 1. Mirror Name Generation
**Location**: `src/lib/mirrorUtils.ts`

- **Function**: `generateUniqueMirrorName(pool)`
- **Format**: `{adjective}_{suffix}{random_chars}`
- **Example**: `shadow_7x9k`, `ghost_alpha3m2p`, `cipher_3xab42`
- **Uniqueness**: Checks against existing `users.mirror_name` values
- **Fallback**: Appends timestamp if 10 attempts fail

**Adjectives**: shadow, ghost, phantom, echo, void, cipher, neon, cyber, glitch, hex, byte, zero, null, dark, rogue

**Suffixes**: 0x-9x, alpha, beta, gamma, delta, echo, foxtrot, omega

#### 2. Mirror Equipment Check
**Location**: `src/lib/mirrorUtils.ts`

- **Function**: `isMirrorEquipped(pool, userId)`
- **Returns**: `boolean` - true if Mirror is equipped
- **Query**: Checks `user_loadout` for `item_id = 68` AND `slot_type = 'slimsoft'`
- **Caching**: Endpoint implementations cache results per-request to avoid redundant DB queries

#### 3. Display Name Resolution
**Location**: `src/lib/mirrorUtils.ts`

- **Function**: `getDisplayName(pool, userId, username, mirrorName)`
- **Logic**: Returns `mirror_name` if Mirror equipped, otherwise returns `username`
- **Fallback**: Returns 'Unknown' if both names are null

### User Creation

**Location**: `src/app/api/onboarding/complete/route.ts`

When a new user is created during onboarding:
1. Generate unique mirror_name using `generateUniqueMirrorName(pool)`
2. Insert into users table with both `username` and `mirror_name`
3. Username defaults to `user_{fid}` placeholder
4. Mirror name is randomized and unique from creation

### Public Activity Endpoints

All public activity endpoints now implement Mirror obfuscation:

#### 1. Zone All-History
**Location**: `src/app/api/zones/[zone]/all-history/route.ts`

- Fetches `username` and `mirror_name` from users table
- Checks Mirror equipped status for each unique user
- Caches results in Map to avoid redundant DB queries
- Displays mirror_name when Mirror equipped

#### 2. City All-History  
**Location**: `src/app/api/city/all-history/route.ts`

- Same implementation as zone history
- Applies to city-wide activity feed
- Includes location suffixes with obfuscated names

#### 3. Protocol All-History
**Location**: `src/app/api/protocols/[protocol]/route.ts`

- Fetches `username`, `mirror_name`, and `user_id` from protocol history
- Implements Mirror check with caching
- Shows obfuscated names in protocol activity

#### 4. Subnet All-History
**Location**: `src/app/api/subnets/[subnet]/route.ts`

- Same pattern as other endpoints
- Applies to subnet-specific activity
- Includes POI and zone context with obfuscation

### Implementation Pattern

All activity endpoints follow this pattern:

```typescript
import { isMirrorEquipped } from '~/lib/mirrorUtils';

// In SQL query: fetch u.username, u.mirror_name, uzh.user_id

// Cache Mirror status per user
const userMirrorStatus = new Map<number, boolean>();

const formattedHistory = await Promise.all(historyRows.map(async (row: any) => {
  // Check cache first
  let mirrorEquipped = userMirrorStatus.get(row.user_id);
  if (mirrorEquipped === undefined) {
    mirrorEquipped = await isMirrorEquipped(pool, row.user_id);
    userMirrorStatus.set(row.user_id, mirrorEquipped);
  }

  // Determine display name
  let alias = row.username || 'Unknown';
  if (mirrorEquipped && row.mirror_name) {
    alias = row.mirror_name;
  }

  // Use alias in message formatting
  const message = `[${alias}] performed action`;
  
  return { id: row.id, message, timestamp: row.timestamp };
}));
```

## Special Cases

### Faction-Specific Names
Certain actions use faction-specific identities instead of username/mirror_name:

- **Recon actions**: Use `rednet_id` (RedNet faction)
- **Fortify actions**: Use `subversive_id` (Subversive faction)

These override Mirror obfuscation as they represent faction operations.

### Private Activity
Mirror obfuscation only applies to "All Activity" feeds. User-specific history views (my history) still show actual usernames since users viewing their own data don't need obfuscation.

## Performance Considerations

### Caching Strategy
- Mirror equipped status is cached per-request using a `Map<user_id, boolean>`
- Reduces DB queries from O(n) to O(unique_users) per endpoint call
- Critical for endpoints with many activity entries (city feed, subnet history)

### Query Optimization
- Single JOIN to fetch both username and mirror_name
- No additional queries needed per row
- Index on `user_loadout(user_id, item_id, slot_type)` ensures fast equipment checks

## Testing Checklist

- [ ] Verify mirror_name is populated on new user creation
- [ ] Confirm Mirror equipped check works correctly
- [ ] Test zone all-history shows mirror_name when equipped
- [ ] Test city all-history shows mirror_name when equipped  
- [ ] Test protocol all-history shows mirror_name when equipped
- [ ] Test subnet all-history shows mirror_name when equipped
- [ ] Verify username shown when Mirror NOT equipped
- [ ] Confirm faction names (rednet_id, subversive_id) still work
- [ ] Check performance with many users in activity feed
- [ ] Verify uniqueness of generated mirror_names

## Future Enhancements

Potential improvements:
1. Allow users to customize their mirror_name (with uniqueness check)
2. Add mirror_name regeneration command
3. Track Mirror usage statistics (time equipped, activities while obfuscated)
4. Create "Mirror Mode" indicator in UI when Mirror is equipped
5. Add mirror_name to user profile display
6. Implement mirror_name search/lookup restrictions for privacy

## Database Migration

To enable Mirror functionality for existing users:

```sql
-- Ensure mirror_name column exists
ALTER TABLE users ADD COLUMN mirror_name VARCHAR(50) UNIQUE NULL;

-- Generate mirror_names for existing users
-- Run via application script to ensure uniqueness checking
```

**Note**: New users automatically receive mirror_name via onboarding flow.

## Dependencies

- `mysql2/promise`: Database connection pool
- `src/lib/logger.ts`: Logging utility
- `src/lib/db.ts`: Database pool management
- `src/lib/api/userUtils.ts`: User ID resolution

## Related Files

**Core Implementation**:
- `src/lib/mirrorUtils.ts` - Mirror utility functions
- `src/app/api/onboarding/complete/route.ts` - User creation with mirror_name

**Public Activity Endpoints**:
- `src/app/api/zones/[zone]/all-history/route.ts`
- `src/app/api/city/all-history/route.ts`
- `src/app/api/protocols/[protocol]/route.ts`
- `src/app/api/subnets/[subnet]/route.ts`

**Database Schema**:
- `users` table - Contains mirror_name field
- `user_loadout` table - Tracks equipped slimsoft
- `items` table - Contains Mirror item (ID 68)
