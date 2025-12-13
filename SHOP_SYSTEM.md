# Shop System Implementation Guide

## Overview
Shops are a new type of Point of Interest (POI) that players can discover and interact with to purchase items using credits or street cred.

## Architecture

### Shop Types
1. **Physical Shops**: Located in zones, discovered via scouting
2. **Virtual Shops**: Located in cyberspace (subnets), discovered via overnet scans
3. **Protocol Shops**: Associated with specific protocols

### Database Schema

#### `shop_inventory`
Stores items available for purchase in each shop:
- `shop_id`: References `points_of_interest.id`
- `item_type`: 'hardware', 'slimsoft', 'consumable', 'gear'
- `item_id`: References the actual item in respective table (nullable for generic items)
- `price`: Cost in credits or street cred
- `currency`: 'credits' or 'street_cred'
- `stock`: -1 for unlimited, 0+ for limited stock
- `required_level`: Minimum level to purchase (optional)
- `required_street_cred`: Minimum street cred to purchase (optional)

#### `shop_transactions`
Transaction history for purchases:
- `user_id`, `shop_id`, `item_id`
- `item_name`, `price`, `currency`
- `timestamp`

#### `user_inventory`
Generic inventory for consumables and gear:
- Tracks quantity of items per user
- Supports stacking (quantity field)

## Discovery Flow

### Physical Shops (Scouting)
1. User scouts a zone
2. On reward roll = 'discovery', system queries `points_of_interest` where `poi_type = 'shop'`
3. Shop unlocked via `user_zone_history` with `action_type = 'UnlockedPOI'`
4. Shop appears in zone's POI list as a clickable card
5. User clicks shop card to navigate to `/shops/{shopId}`

### Virtual Shops (Scanning)
- Same mechanism but for subnet-based shops (future implementation)

## User Interface

### Zone View
- Shops appear in a dedicated "SHOPS" section
- Displayed as clickable banner cards with:
  * Shop icon (🏪 physical, 💾 virtual, 🔗 protocol)
  * Shop name
  * Description
  * Shop type pill
  * Background image (if available)
- Clicking navigates to dedicated shop page

### Shop Detail Page (`/shops/[shopId]`)
Full-page experience similar to contacts/encounters:
- **Header Section**:
  * Shopkeeper image (large, 128x128)
  * Shop name with icon
  * Shopkeeper name
  * Shop type and location pills
  * Shopkeeper quote (italic, with border)
  * Shop description
- **Inventory Grid**:
  * 2-column responsive grid (1 column on mobile)
  * Each item card shows:
    - Item image
    - Name and description
    - Type and stock
    - Requirements (level, street cred)
    - Price and currency
    - BUY button
- **Purchase Flow**:
  * Click BUY → API call → Success/error message
  * Inventory auto-refreshes after purchase
  * Button shows "BUYING..." during transaction

## Purchase Flow

### Client Side (ShopCard Component)
1. User clicks BROWSE to expand shop
2. Component fetches `/api/shops/{shopId}/inventory`
3. Displays items with price, requirements, stock
4. User clicks BUY on eligible item
5. Component calls `/api/shops/purchase?fid={fid}` with `shopId` and `itemId`
6. On success, refreshes inventory and user data

### Server Side (Purchase API)
1. Validates user exists and has sufficient funds
2. Checks item requirements (level, street cred)
3. Checks stock availability
4. **Transaction**:
   - Deducts currency (credits or street_cred)
   - Adds item to appropriate table:
     - `hardware` → `user_hardware`
     - `slimsoft` → `user_slimsoft`
     - `consumable`/`gear` → `user_inventory`
   - Updates stock (if not unlimited)
   - Records transaction in `shop_transactions`
   - Logs activity
5. Returns success with item details

## Integration Points

### Zone Detail Page (`/city/[zone]/page.tsx`)
- Separates POIs into TERMINALS and SHOPS sections
- Terminals: Breachable POIs (existing flow)
- Shops: ShopCard components (new)
- Physical shops require being at location (future feature)

### Components

#### Shop Banner Card (Zone Page)
Clickable card in zone's shops section:
- Shop name and icon
- Description
- Shop type pill
- Background image
- Navigates to `/shops/{shopId}` on click

#### Shop Detail Page
Full-page component at `/shops/[shopId]/page.tsx`:
- Header with shopkeeper portrait
- Shop metadata (name, type, location, quote)
- Item grid with purchase buttons
- Real-time purchase validation
- Success/error messaging

## Future Enhancements

### Planned Features
1. **Location-based purchases**: Require user to be at zone for physical shops
2. **Shop restocking**: Daily/weekly automatic restocking
3. **Shop tiers**: Different quality shops in different zones
4. **Special shop types**:
   - Black market (illegal goods, higher street cred requirements)
   - Protocol shops (unique to certain protocols)
   - Faction shops (reputation-based access)
5. **Dynamic pricing**: Prices based on supply/demand
6. **Bulk purchases**: Quantity selection
7. **Wishlist**: Save items for later
8. **Shop quests**: Unlock better inventory through missions

### Virtual Shops (Cyberspace)
- Discovered via Overnet Scan
- Located in subnets instead of zones
- May have different inventory than physical shops
- Potentially automated/AI-run shops

### Protocol Shops
- Associated with specific protocols
- Unlock when user gains access to protocol
- Sell protocol-specific gear and upgrades

## Item Types

### Hardware
- Cyberdecks, processors, memory, etc.
- Added to `user_hardware`, requires equipping

### Slimsoft
- Software effects and abilities
- Added to `user_slimsoft`, can be equipped/active

### Consumables
- One-time use items (energy drinks, medkits, etc.)
- Stored in `user_inventory` with quantity
- Usage would trigger effects and decrement quantity

### Gear
- Persistent equipment (clothing, tools, etc.)
- Stored in `user_inventory`
- May provide passive bonuses when equipped

## Setup Instructions

1. **Run SQL schema**: Execute `database/shop_schema.sql`
2. **Add shops to zones**: Insert shop POIs into `points_of_interest` with `poi_type = 'shop'`
3. **Populate inventory**: Add items to `shop_inventory` for each shop
4. **Test discovery**: Scout zones to discover shops
5. **Test purchases**: Browse and buy items

## Example Shop Data

```sql
-- Create a shop in zone 1
INSERT INTO points_of_interest (zone_id, name, poi_type, description, breach_difficulty, image_url, shopkeeper_name, shopkeeper_quote)
VALUES (
  1, 
  'Chrome & Code', 
  'shop', 
  'Underground tech shop specializing in cutting-edge cyberware and neural enhancements',
  0, 
  '/imgs/shops/chrome-code.png',
  'Ratchet',
  'Got the chrome you need to stay ahead of corpo scum. No questions asked.'
);

-- Add inventory (assuming shop_id = 1)
INSERT INTO shop_inventory (shop_id, name, description, item_type, item_id, price, currency, stock) VALUES
(1, 'Neural Booster', 'Temporarily increases cognition', 'consumable', NULL, 100, 'credits', -1),
(1, 'Stealth Module', 'Reduces detection during breaches', 'slimsoft', 3, 500, 'credits', 5),
(1, 'Encrypted Deck', 'High-end cyberdeck with built-in encryption', 'hardware', 5, 2000, 'street_cred', 2);
```

## API Endpoints

### GET `/api/shops/[shopId]/details?fid={fid}`
Returns shop details including shopkeeper info
- Validates user has unlocked shop
- Returns shop metadata, location, shopkeeper name/quote

### GET `/api/shops/[shopId]/inventory`
Returns all available items in a shop
- Filters out out-of-stock items (unless unlimited)
- Sorted by item_type and price

### POST `/api/shops/purchase?fid={fid}`
Body: `{ shopId, itemId }`
- Validates requirements
- Processes transaction
- Returns success with item details

## Testing Checklist

- [ ] Shop discovery via scouting
- [ ] Shop appears in zone POI list
- [ ] Shop inventory loads correctly
- [ ] Purchase validation (credits, level, stock)
- [ ] Successful purchase updates user data
- [ ] Stock decrements properly
- [ ] Transaction recorded in history
- [ ] Activity logged
- [ ] Error messages display correctly
- [ ] UI refreshes after purchase
