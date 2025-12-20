# Junk Message System

## Overview

The junk message system sends random spam/junk messages to users based on activity patterns. Junk messages are stored in the `messages_junk` table and tracked separately from regular story messages.

## Triggers

### 1. **Inactivity-Based Triggers**

#### 48-168 Hour Window (2-7 days)
- If a user has been inactive for **48-168 hours**, send one junk message
- Inactivity is measured by:
  - Last message received (`msg_history.unlocked_at`)
  - Last activity logged (`activity_ledger.timestamp`)
  - Uses whichever is more recent
- Only one junk message per window (no repeats)

#### 336+ Hour Window (14+ days)
- If a user has been inactive for **336+ hours** (14 days), send one final junk message
- After this final message, **stop checking** for this user
- This is the "last attempt" to re-engage the user

### 2. **Activity-Based Triggers**

#### Zone Discovery
- When a user discovers a new zone (via city exploration)
- **1-in-20 chance** (5% probability) of triggering a junk message
- Delivery is scheduled randomly between **5-500 minutes** later
- Keeps active users engaged with occasional spam messages

## Implementation

### Database Schema

```sql
-- msg_history now has a msg_type column to distinguish message sources
ALTER TABLE msg_history
ADD COLUMN msg_type VARCHAR(20) DEFAULT 'message' NOT NULL;

-- msg_type values:
-- 'message' = regular story messages from messages table
-- 'junk' = junk/spam messages from messages_junk table
```

### API Endpoints

#### `/api/messages/process-junk` (POST)
- **Purpose**: Check all users for junk message eligibility based on inactivity
- **Schedule**: Run every hour via cron
- **Logic**:
  1. For each user, get last activity time (messages OR activity_ledger)
  2. If 336+ hours inactive and no junk sent recently → send final junk message
  3. If 48-168 hours inactive and no junk sent in window → send one junk message
  4. Schedule delivery 5-500 minutes in future

#### `/api/messages/process-junk` (GET)
- **Purpose**: Debug endpoint to check junk eligibility for specific user
- **Parameters**: `?fid=300187`
- **Returns**: Last activity, hours since active, eligibility status

#### `/api/messages/deliver-scheduled` (POST)
- **Purpose**: Deliver all scheduled messages (both regular and junk)
- **Schedule**: Run every minute via cron
- **Logic**: Finds messages where `scheduled_for <= NOW()`, updates status to 'UNREAD'

### Integration Points

#### Zone Discovery Trigger
Located in: `src/app/api/city/explore-results/route.ts`

```typescript
import { triggerJunkMessageWithProbability } from '../../../../lib/messageScheduler';

// After zone discovery is logged
await triggerJunkMessageWithProbability(userId, 0.05, 'ZONE_DISCOVERY');
```

### Utility Functions

Located in: `src/lib/messageScheduler.ts`

```typescript
// Schedule a random junk message
await scheduleJunkMessage(userId, 'REASON');

// Trigger with probability (e.g., 1-in-20 = 0.05)
await triggerJunkMessageWithProbability(userId, 0.05, 'ZONE_DISCOVERY');

// Get last activity time for user
const lastActive = await getLastActivityTime(userId);
```

## Cron Setup

### Recommended Schedule

```bash
# Check junk message eligibility (inactivity-based)
# Every hour
0 * * * * curl -X POST https://your-domain.com/api/messages/process-junk

# Deliver scheduled messages
# Every minute
* * * * * curl -X POST https://your-domain.com/api/messages/deliver-scheduled
```

## Message Display

Junk messages appear in the inbox alongside regular messages:
- **Sender**: Uses `sent_from` field (e.g., "SPAM_BOT_3000", "UNKNOWN", "SYSTEM")
- **No Contact Link**: Junk messages don't link to contacts (contact_id is NULL)
- **Icon**: Shows generic message icon instead of contact avatar
- **Filtering**: Can be distinguished by `msg_type = 'junk'` in queries

## Database Queries

### Get All Messages (Regular + Junk)
```sql
SELECT * FROM (
  -- Regular messages
  SELECT m.id, m.msg_code, m.msg_title, 
         c.display_name AS sender, mh.unlocked_at
  FROM msg_history mh
  JOIN messages m ON mh.msg_id = m.id AND mh.msg_type = 'message'
  LEFT JOIN contacts c ON m.contact = c.id
  WHERE mh.user_id = ?
  
  UNION ALL
  
  -- Junk messages
  SELECT mj.id, mj.msg_code, mj.msg_title,
         mj.sent_from AS sender, mh.unlocked_at
  FROM msg_history mh
  JOIN messages_junk mj ON mh.msg_id = mj.id AND mh.msg_type = 'junk'
  WHERE mh.user_id = ?
) AS all_messages
ORDER BY unlocked_at DESC;
```

### Check User Inactivity
```sql
-- Get most recent activity (messages OR activity_ledger)
SELECT GREATEST(
  COALESCE(MAX(mh.unlocked_at), '1970-01-01'),
  COALESCE((SELECT MAX(timestamp) FROM activity_ledger WHERE user_id = ?), '1970-01-01')
) AS last_active
FROM msg_history mh
WHERE mh.user_id = ?;
```

## Future Extensions

This same scheduling logic can be reused for:

### Gig Eligibility
- Check if user meets requirements for new gigs
- Schedule gig unlock notifications
- Track gig completion prerequisites

### Contact Eligibility
- Unlock new contacts based on story progression
- Schedule contact introduction messages
- Track contact relationship requirements

### Implementation Pattern
```typescript
// Similar to message eligibility checking
async function checkGigEligibility(userId: number, gigId: number): Promise<boolean> {
  // Check gig_requirements table
  // Validate all prerequisites met
  // Schedule unlock if eligible
}
```

## Testing

### Test Junk Eligibility
```bash
# Check if user is eligible for junk messages
curl "https://your-domain.com/api/messages/process-junk?fid=300187"
```

### Manually Trigger Junk Check
```bash
# Process all users for junk eligibility
curl -X POST https://your-domain.com/api/messages/process-junk
```

### Check Scheduled Messages
```bash
# See how many messages are scheduled
curl https://your-domain.com/api/messages/deliver-scheduled
```

## Notes

- Junk messages are non-critical, so errors are caught and logged but don't throw
- Zone discovery trigger is async and won't block gameplay if it fails
- Inactivity checking uses OR logic: inactive if no messages AND no activity
- Final inactivity message (336+ hours) is the last attempt before giving up
- Active users can still receive junk messages via zone discovery trigger
