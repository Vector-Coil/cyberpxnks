import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

/**
 * Deliver scheduled messages that are due (NOW() or in the past)
 * Handles both regular messages and junk messages
 * Should be called frequently (e.g., every minute via cron)
 */
export async function POST(request: NextRequest) {
  try {
    const pool = await getDbPool();
    
    // Find all scheduled messages where delivery time has passed
    const [scheduledRows] = await pool.execute(
      `SELECT mh.id, mh.user_id, mh.msg_id, mh.msg_type,
              COALESCE(m.msg_code, mj.msg_code) as msg_code
       FROM msg_history mh
       LEFT JOIN messages m ON mh.msg_id = m.id AND mh.msg_type = 'message'
       LEFT JOIN messages_junk mj ON mh.msg_id = mj.id AND mh.msg_type = 'junk'
       WHERE mh.status = 'SCHEDULED' 
       AND mh.scheduled_for <= NOW()`
    );
    
    const scheduled = scheduledRows as any[];
    
    if (scheduled.length === 0) {
      return NextResponse.json({ 
        success: true, 
        delivered: 0,
        message: 'No messages ready for delivery'
      });
    }
    
    // Deliver each message
    for (const msg of scheduled) {
      await pool.execute(
        `UPDATE msg_history 
         SET status = 'UNREAD', unlocked_at = NOW(), scheduled_for = NULL
         WHERE id = ?`,
        [msg.id]
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      delivered: scheduled.length,
      message: `Delivered ${scheduled.length} message(s)`,
      messages: scheduled.map((m: any) => ({ 
        user_id: m.user_id, 
        msg_code: m.msg_code,
        msg_type: m.msg_type
      }))
    });
  } catch (error: any) {
    console.error('Error delivering scheduled messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET endpoint to check how many messages are scheduled
 */
export async function GET(request: NextRequest) {
  try {
    const pool = await getDbPool();
    
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN scheduled_for <= NOW() THEN 1 ELSE 0 END) as ready,
              SUM(CASE WHEN scheduled_for > NOW() THEN 1 ELSE 0 END) as pending
       FROM msg_history
       WHERE status = 'SCHEDULED'`
    );
    
    const stats = (rows as any[])[0];
    
    return NextResponse.json({
      total: stats.total || 0,
      ready: stats.ready || 0,
      pending: stats.pending || 0
    });
  } catch (error: any) {
    console.error('Error checking scheduled messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
