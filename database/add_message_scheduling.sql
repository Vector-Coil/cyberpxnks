-- Add scheduled_for column to msg_history table
-- This tracks when a scheduled message should be delivered

ALTER TABLE msg_history 
ADD COLUMN scheduled_for DATETIME NULL AFTER status;

-- Add index for efficient querying of scheduled messages
CREATE INDEX idx_msg_history_scheduled 
ON msg_history(status, scheduled_for);

-- Example: Check scheduled messages ready for delivery
-- SELECT * FROM msg_history 
-- WHERE status = 'SCHEDULED' AND scheduled_for <= NOW();
