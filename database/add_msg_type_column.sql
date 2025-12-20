-- Add msg_type column to msg_history to distinguish between regular messages and junk messages
-- 'message' = regular messages from messages table
-- 'junk' = junk messages from messages_junk table

ALTER TABLE msg_history
ADD COLUMN msg_type VARCHAR(20) DEFAULT 'message' NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_msg_history_type ON msg_history(msg_type);

-- Update any existing junk messages (if any were already added)
-- This assumes junk messages have msg_id values that exist in messages_junk but not in messages
UPDATE msg_history mh
SET msg_type = 'junk'
WHERE NOT EXISTS (
  SELECT 1 FROM messages m WHERE m.id = mh.msg_id
)
AND EXISTS (
  SELECT 1 FROM messages_junk mj WHERE mj.id = mh.msg_id
);
