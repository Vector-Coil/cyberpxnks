/**
 * Shared utility functions for message scheduling
 * Can be reused for gigs, contacts, and messages
 */

import { getDbPool } from './db';

/**
 * Schedule a random junk message for a user
 * Returns true if scheduled, false if no available messages
 */
export async function scheduleJunkMessage(userId: number, reason: string = 'TRIGGERED'): Promise<boolean> {
  const pool = await getDbPool();
  
  // Get a random junk message that user hasn't received
  const [junkRows] = await pool.execute(
    `SELECT id, msg_code FROM messages_junk 
     WHERE id NOT IN (
       SELECT msg_id FROM msg_history WHERE user_id = ? AND msg_type = 'junk'
     )
     ORDER BY RAND()
     LIMIT 1`,
    [userId]
  );
  
  if (!(junkRows as any[]).length) {
    return false;
  }
  
  const junkMsg = (junkRows as any[])[0];
  
  // Schedule delivery between 5-500 minutes
  const delayMinutes = Math.floor(Math.random() * (500 - 5 + 1)) + 5;
  const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  // Insert into msg_history with SCHEDULED status
  await pool.execute(
    `INSERT INTO msg_history (user_id, msg_id, msg_type, status, scheduled_for) 
     VALUES (?, ?, 'junk', 'SCHEDULED', ?)`,
    [userId, junkMsg.id, scheduledFor]
  );
  
  console.log(`Scheduled junk message ${junkMsg.msg_code} for user ${userId} (reason: ${reason})`);
  
  return true;
}

/**
 * Trigger junk message with a given probability
 * @param userId - User ID
 * @param probability - Chance of triggering (0-1), e.g., 0.05 for 1-in-20
 * @param reason - Reason for trigger (for logging)
 */
export async function triggerJunkMessageWithProbability(
  userId: number, 
  probability: number = 0.05,
  reason: string = 'RANDOM'
): Promise<boolean> {
  if (Math.random() >= probability) {
    return false; // No trigger this time
  }
  
  try {
    return await scheduleJunkMessage(userId, reason);
  } catch (error) {
    console.error('Error scheduling junk message:', error);
    return false;
  }
}

/**
 * Get last activity time for a user (messages OR activity ledger)
 */
export async function getLastActivityTime(userId: number): Promise<Date | null> {
  const pool = await getDbPool();
  
  // Get last message received time
  const [lastMsgRows] = await pool.execute(
    `SELECT MAX(unlocked_at) as last_msg 
     FROM msg_history 
     WHERE user_id = ? AND unlocked_at IS NOT NULL`,
    [userId]
  );
  
  // Get last activity time
  const [lastActivityRows] = await pool.execute(
    `SELECT MAX(timestamp) as last_activity 
     FROM activity_ledger 
     WHERE user_id = ?`,
    [userId]
  );
  
  const lastMsg = (lastMsgRows as any[])[0]?.last_msg;
  const lastActivity = (lastActivityRows as any[])[0]?.last_activity;
  
  // Return most recent
  if (lastMsg && lastActivity) {
    return new Date(Math.max(new Date(lastMsg).getTime(), new Date(lastActivity).getTime()));
  } else if (lastMsg) {
    return new Date(lastMsg);
  } else if (lastActivity) {
    return new Date(lastActivity);
  }
  
  return null;
}
