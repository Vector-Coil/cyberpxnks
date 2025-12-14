# Code Refactoring Implementation Guide

## Overview

This guide documents the new utilities and patterns introduced to improve code quality, maintainability, and consistency across the cyberpxnks codebase.

---

## 🆕 New Utilities Created

### 1. **Structured Logging** (`src/lib/logger.ts`)

Replaces scattered `console.log` statements with consistent, structured logging.

**Features:**
- Different log levels (DEBUG, INFO, WARN, ERROR)
- Automatic timestamps
- Structured metadata support
- Development/production mode awareness

**Usage:**
```typescript
import { logger } from '~/lib/logger';

logger.info('User logged in', { fid: 12345 });
logger.error('Database error', error, { query: 'SELECT ...' });
logger.debug('Processing item', { itemId: 42 });
logger.apiRequest('GET', '/api/user', { fid });
logger.dbQuery('SELECT * FROM users WHERE fid = ?', [fid]);
```

**Migration:**
```typescript
// OLD
console.log('Fetching user stats:', stats);
console.error('Failed to fetch stats:', error);

// NEW
logger.info('Fetching user stats', { stats });
logger.error('Failed to fetch stats', error);
```

---

### 2. **API Error Handling** (`src/lib/api/errors.ts`)

Provides consistent error responses and reduces error handling boilerplate.

**Features:**
- `ApiError` class with HTTP status codes
- `handleApiError()` for consistent error responses
- Common error factories (`ApiErrors.NotFound()`, etc.)
- Parameter validation helpers

**Usage:**
```typescript
import { ApiError, ApiErrors, handleApiError, validateFid, requireParams } from '~/lib/api/errors';

export async function GET(req: Request) {
  try {
    const fid = validateFid(searchParams.get('fid'));
    const user = await getUserByFid(pool, fid);
    
    if (!canAccess) {
      throw ApiErrors.Forbidden('Cannot access this resource');
    }
    
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'GET /api/user');
  }
}
```

**Common Error Factories:**
- `ApiErrors.NotFound(resource)` - 404 errors
- `ApiErrors.BadRequest(message)` - 400 errors
- `ApiErrors.Unauthorized()` - 401 errors
- `ApiErrors.InsufficientResources(resource)` - Resource validation failures
- `ApiErrors.InvalidParameter(param)` - Invalid parameters

**Migration:**
```typescript
// OLD
if (!fid) {
  return NextResponse.json({ error: 'FID is required' }, { status: 400 });
}
const fid = parseInt(fidParam, 10);
if (Number.isNaN(fid)) {
  return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
}

// NEW
const fid = validateFid(searchParams.get('fid'));
```

---

### 3. **User Utilities** (`src/lib/api/userUtils.ts`)

Eliminates the most common code duplication: fetching users by FID.

**Functions:**
- `getUserByFid(pool, fid)` - Get full user object, throws if not found
- `getUserIdByFid(pool, fid)` - Get user ID only
- `userExists(pool, fid)` - Check if user exists
- `getUserById(pool, userId)` - Get user by internal ID
- `isAdmin(pool, fid)` - Check admin status

**Usage:**
```typescript
import { getUserByFid } from '~/lib/api/userUtils';

const user = await getUserByFid(pool, fid);
// user.id, user.username, user.fid, etc. are guaranteed to exist
```

**Migration:**
```typescript
// OLD (appears in 50+ files)
const [userRows] = await pool.execute<any[]>(
  'SELECT id FROM users WHERE fid = ? LIMIT 1',
  [fid]
);
const user = (userRows as any[])[0];
if (!user) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

// NEW (single line, type-safe)
const user = await getUserByFid(pool, fid);
```

---

### 4. **Resource Validation** (`src/lib/game/resourceValidator.ts`)

Provides consistent validation of game resource requirements.

**Features:**
- Fluent API for chaining validations
- Clear error messages
- Support for percentage-based requirements
- Validates stamina, charge, bandwidth, consciousness, thermal, neural

**Usage:**
```typescript
import { ResourceValidator, validateResources } from '~/lib/game/resourceValidator';

// Quick validation
validateResources(stats.current, {
  stamina: 20,
  bandwidth: 1,
  minConsciousnessPercent: 0.5
}, stats.max);

// Or with fluent API
const validator = new ResourceValidator(stats.current, stats.max);
validator
  .requireStamina(20)
  .requireBandwidth(1)
  .requireConsciousnessPercent(0.5)
  .validate(); // Throws ApiError if validation fails
```

**Migration:**
```typescript
// OLD
if (stats.current_stamina < 20) {
  return NextResponse.json({ error: 'Insufficient stamina' }, { status: 400 });
}
if (stats.current_bandwidth < 1) {
  return NextResponse.json({ error: 'Insufficient bandwidth' }, { status: 400 });
}
if (stats.current_consciousness < (stats.max_consciousness * 0.5)) {
  return NextResponse.json({ error: 'Insufficient consciousness' }, { status: 400 });
}

// NEW
validateResources(stats.current, {
  stamina: 20,
  bandwidth: 1,
  minConsciousnessPercent: 0.5
}, stats.max);
```

---

### 5. **Game Constants** (`src/lib/game/constants.ts`)

Centralizes all game balance parameters for easy tuning.

**Constants:**
- `ACTION_COSTS` - Resource costs for all game actions
- `COOLDOWNS` - Cooldown durations
- `LIMITS` - Game limits and thresholds
- `REGENERATION_RATES` - Regen rates per tick
- `COMBAT` - Combat mechanics
- `REWARDS` - XP and credit multipliers
- `ECONOMY` - Shop and currency settings

**Usage:**
```typescript
import { ACTION_COSTS, COOLDOWNS, getActionCost } from '~/lib/game/constants';

// Use predefined costs
validateResources(stats.current, ACTION_COSTS.ZONE_SCOUT, stats.max);

// Use cooldown durations
const endTime = new Date(Date.now() + COOLDOWNS.ZONE_SCOUT);
```

**Migration:**
```typescript
// OLD (magic numbers scattered throughout code)
const endTime = new Date(timestamp.getTime() + 60 * 60 * 1000); // 1 hour
if (stats.current_stamina < 20) { ... }

// NEW (centralized, named constants)
const endTime = new Date(timestamp.getTime() + COOLDOWNS.ZONE_SCOUT);
validateResources(stats.current, ACTION_COSTS.ZONE_SCOUT, stats.max);
```

---

## 📋 Example Refactored Routes

### Before: `/api/user/route.ts` (OLD)
```typescript
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id, fid, username, admin FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userRows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}
```

### After: `/api/user/route.ts` (NEW)
```typescript
import { getUserByFid } from '../../../lib/api/userUtils';
import { validateFid, handleApiError } from '../../../lib/api/errors';
import { logger } from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const fid = validateFid(request.nextUrl.searchParams.get('fid'));
    logger.apiRequest('GET', '/api/user', { fid });

    const pool = await getDbPool();
    const user = await getUserByFid(pool, fid);

    return NextResponse.json({
      id: user.id,
      fid: user.fid,
      username: user.username,
      admin: user.admin
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/user');
  }
}
```

**Benefits:**
- 30 lines → 20 lines (33% reduction)
- Type-safe (no `any` types)
- Consistent error handling
- Structured logging
- Easier to read and maintain

---

## 🚀 Migration Strategy

### Phase 1: High-Traffic Routes (Priority)
Start with the most frequently called endpoints:
- ✅ `/api/stats` - DONE
- ✅ `/api/user` - DONE
- ✅ `/api/zones/scout` - DONE
- `/api/zones/breach`
- `/api/city/explore`
- `/api/grid/scan`

### Phase 2: User-Facing Routes
- `/api/contacts`
- `/api/hardware`
- `/api/shops/*`
- `/api/inventory`

### Phase 3: Admin/Utility Routes
- `/api/admin/*`
- `/api/debug/*`
- `/api/sync-farcaster`

### Step-by-Step for Each Route

1. **Add imports**
   ```typescript
   import { getUserByFid } from '~/lib/api/userUtils';
   import { validateFid, handleApiError, requireParams } from '~/lib/api/errors';
   import { validateResources } from '~/lib/game/resourceValidator';
   import { ACTION_COSTS, COOLDOWNS } from '~/lib/game/constants';
   import { logger } from '~/lib/logger';
   ```

2. **Replace parameter validation**
   ```typescript
   // Replace manual FID parsing with:
   const fid = validateFid(searchParams.get('fid'));
   
   // Replace manual body validation with:
   requireParams(body, ['zoneId', 'itemId']);
   ```

3. **Replace user lookup**
   ```typescript
   // Replace the entire user query block with:
   const user = await getUserByFid(pool, fid);
   ```

4. **Replace resource validation**
   ```typescript
   // Replace multiple if statements with:
   validateResources(stats.current, ACTION_COSTS.ZONE_SCOUT, stats.max);
   ```

5. **Replace error handling**
   ```typescript
   // Wrap everything in try-catch:
   try {
     // ... route logic
   } catch (error) {
     return handleApiError(error, 'GET /api/route-name');
   }
   ```

6. **Add logging**
   ```typescript
   logger.apiRequest('POST', '/api/zones/scout', { fid, zoneId });
   logger.info('Scout action created', { userId, scoutId });
   ```

---

## ✅ Testing Checklist

After refactoring a route, verify:
- [ ] Route still responds correctly to valid requests
- [ ] Error responses are consistent (JSON with `error` field)
- [ ] Logging appears in console with proper format
- [ ] Type safety (no `any` types added)
- [ ] Resource validation works as expected
- [ ] User lookup throws 404 for invalid FIDs

---

## 📊 Expected Benefits

### Code Quality
- **30-50% reduction** in boilerplate code
- **Eliminated `any` type usage** in user lookups
- **Consistent error responses** across all endpoints
- **Centralized game balance** tuning

### Maintainability
- **Single source of truth** for resource costs
- **Easy to update** game mechanics
- **Clear error messages** for debugging
- **Searchable logs** for troubleshooting

### Developer Experience
- **Less code to write** for new endpoints
- **Fewer bugs** from copy-paste errors
- **Easier onboarding** for new developers
- **Better IDE autocomplete** with TypeScript

---

## 🔄 Next Steps

1. **Gradually migrate routes** using the examples as templates
2. **Update client-side code** to expect consistent error format
3. **Monitor logs** in production to identify issues
4. **Tune game constants** based on playtesting
5. **Add more validators** as patterns emerge

---

## 💡 Tips

- Start with simple routes to get comfortable with the patterns
- Test locally before deploying
- Keep old code commented out during initial migration
- Update multiple related routes together (e.g., all zone routes)
- Use the logger liberally to understand request flow

---

## 🆘 Common Issues

**Issue:** TypeScript errors about missing properties
**Solution:** Ensure you're importing the utilities from the correct paths

**Issue:** Route returns 500 instead of specific error
**Solution:** Make sure you're using `handleApiError()` in the catch block

**Issue:** Resource validation not working
**Solution:** Verify you're passing both `current` and `max` stats to validator

**Issue:** Logger not showing debug messages
**Solution:** Debug logging is only enabled in development mode

---

For questions or issues, check the example routes in:
- `src/app/api/user/route.ts`
- `src/app/api/stats/route.ts`
- `src/app/api/zones/scout/route.ts`
