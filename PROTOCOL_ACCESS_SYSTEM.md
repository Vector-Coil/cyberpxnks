# Protocol Access System

## Overview
The Protocol Access System mirrors the Subnet Access System, tracking which protocols each user has unlocked. Only unlocked protocols are displayed on the Grid page.

## Database Schema

### user_protocol_access Table
```sql
CREATE TABLE user_protocol_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  protocol_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unlock_method VARCHAR(50) DEFAULT 'gig_completed',
  UNIQUE KEY unique_user_protocol (user_id, protocol_id)
)
```

**Fields:**
- `user_id` - References users.id
- `protocol_id` - References protocols.id
- `unlocked_at` - When the protocol was unlocked
- `unlock_method` - How the protocol was unlocked

### Unlock Methods
- `initial_access` - Starter protocol given to all users
- `gig_completed` - Unlocked by completing a gig
- `reputation` - Unlocked by reaching reputation threshold
- `scan_discovery` - Discovered through Overnet scanning
- `story_progression` - Unlocked through story progression
- `purchase` - Purchased from a vendor

## API Implementation

### GET /api/protocols
Returns only the protocols the user has unlocked.

**Query Parameters:**
- `fid` - User's Farcaster ID

**Response:**
```json
[
  {
    "id": 1,
    "name": "Protocol Name",
    "controlling_alignment_id": 1,
    "description": "Protocol description",
    "access_rep_id": null,
    "access_gig_id": 5,
    "image_url": "https://...",
    "alignment_name": "Alignment Name",
    "unlocked_at": "2024-12-27T10:30:00Z",
    "unlock_method": "gig_completed"
  }
]
```

**SQL Query:**
```sql
SELECT 
  p.id,
  p.name,
  p.controlling_alignment_id,
  p.description,
  p.access_rep_id,
  p.access_gig_id,
  p.image_url,
  a.name as alignment_name,
  upa.unlocked_at,
  upa.unlock_method
FROM protocols p
INNER JOIN user_protocol_access upa ON p.id = upa.protocol_id
LEFT JOIN alignments a ON p.controlling_alignment_id = a.id
WHERE upa.user_id = ?
ORDER BY upa.unlocked_at DESC
```

## Granting Protocol Access

### Manual Grant (SQL)
```sql
INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
VALUES (?, ?, 'gig_completed');
```

### Via Gig Completion (Future)
When implementing gig completion rewards:
```javascript
// In gig completion endpoint
if (gig.protocol_reward_id) {
  await pool.execute(
    `INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
     VALUES (?, ?, 'gig_completed')`,
    [userId, gig.protocol_reward_id]
  );
}
```

### Via Scan Discovery (Future)
When implementing Overnet scan results:
```javascript
// In scan completion endpoint
if (scanResult.discoveredProtocol) {
  await pool.execute(
    `INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
     VALUES (?, ?, 'scan_discovery')`,
    [userId, scanResult.protocolId]
  );
}
```

### Via Reputation Threshold (Future)
When implementing reputation checks:
```javascript
// After reputation update
const [protocols] = await pool.execute(
  `SELECT id FROM protocols 
   WHERE access_rep_id = ? AND id NOT IN (
     SELECT protocol_id FROM user_protocol_access WHERE user_id = ?
   )`,
  [reputationId, userId]
);

for (const protocol of protocols) {
  await pool.execute(
    `INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
     VALUES (?, ?, 'reputation')`,
    [userId, protocol.id]
  );
}
```

## Grid Page Display

The Grid page now shows:
- **Subnets** - Filtered by `user_subnet_access` table
- **Protocols** - Filtered by `user_protocol_access` table

Both sections will show empty state messages when no items are unlocked:
- Subnets: "Explore the Net to discover more"
- Protocols: "Complete gigs to unlock new protocols"

## Migration Steps

1. **Run the schema migration:**
   ```sql
   -- Create the table
   source database/user_protocol_access_schema.sql
   ```

2. **Grant initial access (optional):**
   ```sql
   -- Give all users access to protocol ID 1
   source database/grant_protocol_access.sql
   ```

3. **Verify the setup:**
   ```sql
   -- Check protocol access for a user
   SELECT 
     u.username,
     p.name as protocol_name,
     upa.unlock_method,
     upa.unlocked_at
   FROM user_protocol_access upa
   JOIN users u ON upa.user_id = u.id
   JOIN protocols p ON upa.protocol_id = p.id
   WHERE u.fid = 300187;
   ```

## Related Systems

### Similar Pattern: Subnet Access
Protocol access follows the same pattern as subnet access:
- `user_subnet_access` tracks unlocked subnets
- `user_protocol_access` tracks unlocked protocols

Both use:
- INNER JOIN to filter results to only unlocked items
- `unlocked_at` timestamp for tracking when items were discovered
- `unlock_method` field for tracking how items were unlocked

## Future Enhancements

1. **Protocol Requirements Display**
   - Show locked protocols with unlock requirements
   - Display progress toward unlock (e.g., "Complete 3 more gigs")

2. **Protocol Tiers**
   - Implement tiered access (Basic → Advanced → Elite)
   - Require previous tier protocols to unlock next tier

3. **Protocol Trading/Gifting**
   - Allow users to share protocol access with others
   - Implement social unlock mechanics

4. **Achievement Integration**
   - Award protocols for completing achievements
   - Track rare/legendary protocol discoveries
