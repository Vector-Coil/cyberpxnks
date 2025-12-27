-- user_protocol_access table
-- Tracks which protocols each user has unlocked

CREATE TABLE IF NOT EXISTS user_protocol_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  protocol_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unlock_method VARCHAR(50) DEFAULT 'gig_completed',
  -- unlock_method can be: 'gig_completed', 'reputation', 'story_progression', 'scan_discovery', etc.
  UNIQUE KEY unique_user_protocol (user_id, protocol_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE,
  INDEX idx_user_protocols (user_id),
  INDEX idx_protocol_users (protocol_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Seed with initial protocol access
-- For example, give all users access to protocol ID 1 as a starter protocol
-- Uncomment and adjust as needed:
-- INSERT IGNORE INTO user_protocol_access (user_id, protocol_id, unlock_method)
-- SELECT id, 1, 'initial_access' FROM users;
