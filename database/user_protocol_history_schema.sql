-- user_protocol_history table
-- Tracks user actions and activity within protocols

CREATE TABLE IF NOT EXISTS user_protocol_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  protocol_id INT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  -- action_type can be: 'Accessed', 'DataQueried', 'FileTransferred', 'ExecutedCommand', etc.
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  result_status VARCHAR(20) NULL,
  -- result_status: NULL (in progress/ready), 'completed' (viewed), 'dismissed' (hidden)
  gains_data TEXT NULL,
  xp_data INT DEFAULT 0,
  INDEX idx_user_protocol (user_id, protocol_id),
  INDEX idx_protocol_activity (protocol_id, timestamp),
  INDEX idx_result_status (result_status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (protocol_id) REFERENCES protocols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
