-- Shop Implementation SQL Schema
-- Run this to add shop support to your database

-- Add shopkeeper fields to points_of_interest table
ALTER TABLE points_of_interest 
  ADD COLUMN IF NOT EXISTS shopkeeper_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS shopkeeper_quote TEXT NULL;

-- Add shop inventory table
CREATE TABLE IF NOT EXISTS shop_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  item_id INT NOT NULL COMMENT 'References actual item in items table',
  price INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT -1 COMMENT '-1 = unlimited stock',
  stock_replenish INT NULL COMMENT 'Hours until stock resets/replenishes (NULL = no replenish)',
  required_level INT NULL,
  required_street_cred INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shop_id (shop_id),
  INDEX idx_item_id (item_id),
  FOREIGN KEY (shop_id) REFERENCES points_of_interest(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add shop transactions table for purchase history
CREATE TABLE IF NOT EXISTS shop_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shop_id INT NOT NULL,
  item_id INT NOT NULL,
  price INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_shop_id (shop_id),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES points_of_interest(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add user_inventory table for consumables and gear
CREATE TABLE IF NOT EXISTS user_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_type ENUM('consumable', 'gear') NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  acquired_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_item (item_type, item_id),
  UNIQUE KEY unique_user_item (user_id, item_type, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Example: Add a shop POI to a zone (adjust zone_id as needed)
-- INSERT INTO points_of_interest (zone_id, name, poi_type, description, breach_difficulty, image_url)
-- VALUES (1, 'Neon Market', 'shop', 'A bustling tech market selling hardware and slimsoft', 0, '/imgs/shops/neon-market.png');

-- Example: Add items to shop inventory (adjust shop_id to match the POI id created above)
-- INSERT INTO shop_inventory (shop_id, item_id, price, stock) VALUES
-- (1, 1, 500, 10),  -- Item ID 1 at 500 credits, limited stock of 10
-- (2, 5, 300, -1),  -- Item ID 5 at 300 credits, unlimited stock
-- (3, 12, 50, -1);  -- Item ID 12 at 50 credits, unlimited stock

-- Add street_cred column to users table if it doesn't exist
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS street_cred INT NOT NULL DEFAULT 0;

SELECT 'Shop tables created successfully!' AS status;
