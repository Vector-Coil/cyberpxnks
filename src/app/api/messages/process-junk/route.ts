import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

/**
 * Process junk message eligibility for inactive/active users
 * Should be called periodically (e.g., every hour via cron)
 */
export async function POST(request: NextRequest) {
  try {
    const pool = await getDbPool();
    
    // Get all users
    const [userRows] = await pool.execute('SELECT id FROM users');
    const users = userRows as any[];
    
    let totalScheduled = 0;
    
    for (const user of users) {
      const scheduled = await processJunkMessagesForUser(pool, user.id);
      totalScheduled += scheduled;
    }
    
    return NextResponse.json({ 
      success: true, 
      scheduled: totalScheduled,
      message: `Scheduled ${totalScheduled} junk message(s)`
    });
  } catch (error: any) {
    console.error('Error processing junk messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Process junk messages for a single user based on inactivity
 */
async function processJunkMessagesForUser(pool: any, userId: number): Promise<number> {
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
  
  // Determine most recent activity
  let lastActive: Date | null = null;
  if (lastMsg && lastActivity) {
    lastActive = new Date(Math.max(new Date(lastMsg).getTime(), new Date(lastActivity).getTime()));
  } else if (lastMsg) {
    lastActive = new Date(lastMsg);
  } else if (lastActivity) {
    lastActive = new Date(lastActivity);
  }
  
  if (!lastActive) {
    // No activity recorded, skip
    return 0;
  }
  
  const now = new Date();
  const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
  
  // Check if user has already received final inactivity message (336+ hours)
  if (hoursSinceActive >= 336) {
    const [finalMsgRows] = await pool.execute(
      `SELECT id FROM msg_history
       WHERE user_id = ? 
       AND msg_type = 'junk'
       AND unlocked_at >= DATE_SUB(NOW(), INTERVAL 336 HOUR)`,
      [userId]
    );
    
    if ((finalMsgRows as any[]).length > 0) {
      // Already sent final message, stop checking
      return 0;
    }
    
    // Send final inactivity message
    return await scheduleRandomJunkMessage(pool, userId, 'FINAL_INACTIVITY');
  }
  
  // Check if in 48-168 hour window
  if (hoursSinceActive >= 48 && hoursSinceActive < 168) {
    // Check if already sent a junk message in this window
    const [recentJunkRows] = await pool.execute(
      `SELECT id FROM msg_history
       WHERE user_id = ? 
       AND msg_type = 'junk'
       AND unlocked_at >= DATE_SUB(NOW(), INTERVAL 168 HOUR)`,
      [userId]
    );
    
    if ((recentJunkRows as any[]).length > 0) {
      // Already sent junk message in this period
      return 0;
    }
    
    // Schedule junk message
    return await scheduleRandomJunkMessage(pool, userId, 'INACTIVITY');
  }
  
  return 0;
}

/**
 * Schedule a random junk message for delivery
 */
async function scheduleRandomJunkMessage(
  pool: any, 
  userId: number, 
  reason: string
): Promise<number> {
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
    // No available junk messages
    return 0;
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
  
  return 1;
}

/**
 * Trigger junk message with probability when user discovers a zone
 * Call this from zone discovery endpoints
 */
async function triggerZoneDiscoveryJunk(userId: number): Promise<void> {
  // 1 in 20 chance
  const random = Math.random();
  if (random >= 0.05) {
    return; // No junk message this time
  }
  
  try {
    const pool = await getDbPool();
    await scheduleRandomJunkMessage(pool, userId, 'ZONE_DISCOVERY');
  } catch (error) {
    console.error('Error scheduling zone discovery junk message:', error);
    // Don't throw - junk messages are non-critical
  }
}

/**
 * GET endpoint to check junk message eligibility for a user
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  
  if (!fid) {
    return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
  }
  
  try {
    const pool = await getDbPool();
    
    // Get user ID
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    
    if (!(userRows as any[]).length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = (userRows as any[])[0].id;
    
    // Get last message and activity
    const [lastMsgRows] = await pool.execute(
      `SELECT MAX(unlocked_at) as last_msg 
       FROM msg_history 
       WHERE user_id = ? AND unlocked_at IS NOT NULL`,
      [userId]
    );
    
    const [lastActivityRows] = await pool.execute(
      `SELECT MAX(timestamp) as last_activity 
       FROM activity_ledger 
       WHERE user_id = ?`,
      [userId]
    );
    
    const lastMsg = (lastMsgRows as any[])[0]?.last_msg;
    const lastActivity = (lastActivityRows as any[])[0]?.last_activity;
    
    let lastActive: Date | null = null;
    if (lastMsg && lastActivity) {
      lastActive = new Date(Math.max(new Date(lastMsg).getTime(), new Date(lastActivity).getTime()));
    } else if (lastMsg) {
      lastActive = new Date(lastMsg);
    } else if (lastActivity) {
      lastActive = new Date(lastActivity);
    }
    
    let hoursSinceActive = 0;
    let eligible = false;
    let reason = '';
    
    if (lastActive) {
      const now = new Date();
      hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceActive >= 336) {
        reason = 'Final inactivity message (336+ hours)';
        eligible = true;
      } else if (hoursSinceActive >= 48 && hoursSinceActive < 168) {
        reason = 'Inactivity window (48-168 hours)';
        eligible = true;
      }
    }
    
    return NextResponse.json({
      userId,
      fid,
      lastMessage: lastMsg,
      lastActivity: lastActivity,
      lastActive: lastActive,
      hoursSinceActive: Math.floor(hoursSinceActive),
      eligible,
      reason
    });
  } catch (error: any) {
    console.error('Error checking junk message eligibility:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
