import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

/**
 * Background job to check message eligibility and schedule delivery
 * Should be called periodically (e.g., every 5 minutes via cron)
 */
export async function POST(request: NextRequest) {
  try {
    const pool = await getDbPool();
    
    // Get all users
    const [userRows] = await pool.execute('SELECT id FROM users');
    const users = userRows as any[];
    
    let totalScheduled = 0;
    
    for (const user of users) {
      // Get all messages that user hasn't received yet
      const [unreceivedRows] = await pool.execute(
        `SELECT m.id, m.msg_code 
         FROM messages m
         WHERE m.id NOT IN (
           SELECT msg_id FROM msg_history WHERE user_id = ? AND msg_type = 'message'
         )`,
        [user.id]
      );
      
      const unreceived = unreceivedRows as any[];
      
      for (const msg of unreceived) {
        // Check if requirements are met
        const eligible = await checkMessageRequirements(pool, user.id, msg.id);
        
        if (eligible) {
          // Schedule delivery between 5-500 minutes from now
          const delayMinutes = Math.floor(Math.random() * (500 - 5 + 1)) + 5;
          const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
          
          // Insert into msg_history with SCHEDULED status
          await pool.execute(
            `INSERT INTO msg_history (user_id, msg_id, msg_type, status, scheduled_for) 
             VALUES (?, ?, 'message', 'SCHEDULED', ?)`,
            [user.id, msg.id, scheduledFor]
          );
          
          totalScheduled++;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      scheduled: totalScheduled,
      message: `Scheduled ${totalScheduled} messages for delivery`
    });
  } catch (error: any) {
    console.error('Error processing message eligibility:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check if user meets all requirements for a message
 */
async function checkMessageRequirements(
  pool: any, 
  userId: number, 
  messageId: number
): Promise<boolean> {
  // Get requirements from msg_requirements table
  const [reqRows] = await pool.execute(
    'SELECT req_1, req_2, req_3 FROM msg_requirements WHERE msg_id = ?',
    [messageId]
  );
  
  // No requirements = always eligible
  if (!(reqRows as any[]).length) return true;
  
  const req = (reqRows as any[])[0];
  const requirements = [req.req_1, req.req_2, req.req_3].filter((r: any) => r && r.trim());
  
  // No requirements specified = always eligible
  if (requirements.length === 0) return true;
  
  // Check each requirement (ALL must be met)
  for (const reqStr of requirements) {
    const parts = reqStr.split('_');
    if (parts.length !== 2) continue;
    
    const type = parts[0];
    const id = parseInt(parts[1], 10);
    
    if (isNaN(id)) continue;
    
    if (type === 'gig') {
      // Check if gig completed
      const [rows] = await pool.execute(
        `SELECT id FROM gig_history 
         WHERE user_id = ? AND gig_id = ? 
         AND (status = 'COMPLETED' OR last_completed_at IS NOT NULL)
         LIMIT 1`,
        [userId, id]
      );
      if (!(rows as any[]).length) return false;
    }
    else if (type === 'contact') {
      // Check if contact unlocked
      const [rows] = await pool.execute(
        'SELECT id FROM contact_history WHERE user_id = ? AND contact_id = ? LIMIT 1',
        [userId, id]
      );
      if (!(rows as any[]).length) return false;
    }
    else if (type === 'item') {
      // Check if item acquired
      const [rows] = await pool.execute(
        'SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1',
        [userId, id]
      );
      if (!(rows as any[]).length) return false;
    }
    else if (type === 'msg') {
      // Check if previous message received
      const [rows] = await pool.execute(
        'SELECT id FROM msg_history WHERE user_id = ? AND msg_id = ? LIMIT 1',
        [userId, id]
      );
      if (!(rows as any[]).length) return false;
    }
  }
  
  return true; // All requirements met
}
