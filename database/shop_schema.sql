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
  name VARCHAR(255) NOT NULL,
  description TEXT,
  item_type ENUM('hardware', 'slimsoft', 'consumable', 'gear') NOT NULL,
  item_id INT NULL COMMENT 'References actual item in hardware/slimsoft/consumable tables',
  price INT NOT NULL DEFAULT 0,
  currency ENUM('credits', 'street_cred') NOT NULL DEFAULT 'credits',
  stock INT NOT NULL DEFAULT -1 COMMENT '-1 = unlimited stock',
  required_level INT NULL,
  required_street_cred INT NULL,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shop_id (shop_id),
  INDEX idx_item_type (item_type),
  FOREIGN KEY (shop_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add shop transactions table for purchase history
CREATE TABLE IF NOT EXISTS shop_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shop_id INT NOT NULL,
  item_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  currency ENUM('credits', 'street_cred') NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_shop_id (shop_id),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
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
-- INSERT INTO shop_inventory (shop_id, name, description, item_type, item_id, price, currency, stock) VALUES
-- (1, 'Basic Cyberdeck', 'Entry-level cyberdeck for beginners', 'hardware', 1, 500, 'credits', 10),
-- (2, 'Firewall Slimsoft', 'Increases your defenses', 'slimsoft', 1, 300, 'credits', -1),
-- (3, 'Energy Drink', 'Restores 20 stamina', 'consumable', 1, 50, 'credits', -1);

-- Add street_cred column to users table if it doesn't exist
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS street_cred INT NOT NULL DEFAULT 0;

SELECT 'Shop tables created successfully!' AS status;
