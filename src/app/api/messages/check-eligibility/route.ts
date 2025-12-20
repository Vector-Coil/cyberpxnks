import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

/**
 * Check which messages a specific user is eligible for
 * Useful for testing and debugging
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
    
    // Get all messages user hasn't received
    const [unreceivedRows] = await pool.execute(
      `SELECT m.id, m.msg_code, m.msg_title
       FROM messages m
       WHERE m.id NOT IN (
         SELECT msg_id FROM msg_history WHERE user_id = ?
       )`,
      [userId]
    );
    
    const unreceived = unreceivedRows as any[];
    const results = [];
    
    for (const msg of unreceived) {
      // Get requirements
      const [reqRows] = await pool.execute(
        'SELECT req_1, req_2, req_3 FROM msg_requirements WHERE msg_id = ?',
        [msg.id]
      );
      
      const requirements = [];
      const requirementsMet = [];
      let eligible = true;
      
      if ((reqRows as any[]).length) {
        const req = (reqRows as any[])[0];
        const reqs = [req.req_1, req.req_2, req.req_3].filter((r: any) => r && r.trim());
        
        for (const reqStr of reqs) {
          const parts = reqStr.split('_');
          if (parts.length !== 2) continue;
          
          const type = parts[0];
          const id = parseInt(parts[1], 10);
          
          requirements.push(reqStr);
          
          let met = false;
          
          if (type === 'gig') {
            const [rows] = await pool.execute(
              `SELECT id FROM gig_history 
               WHERE user_id = ? AND gig_id = ? 
               AND (status = 'COMPLETED' OR last_completed_at IS NOT NULL)
               LIMIT 1`,
              [userId, id]
            );
            met = !!(rows as any[]).length;
          }
          else if (type === 'contact') {
            const [rows] = await pool.execute(
              'SELECT id FROM contact_history WHERE user_id = ? AND contact_id = ? LIMIT 1',
              [userId, id]
            );
            met = !!(rows as any[]).length;
          }
          else if (type === 'item') {
            const [rows] = await pool.execute(
              'SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1',
              [userId, id]
            );
            met = !!(rows as any[]).length;
          }
          else if (type === 'msg') {
            const [rows] = await pool.execute(
              'SELECT id FROM msg_history WHERE user_id = ? AND msg_id = ? LIMIT 1',
              [userId, id]
            );
            met = !!(rows as any[]).length;
          }
          
          requirementsMet.push({ requirement: reqStr, met });
          
          if (!met) {
            eligible = false;
          }
        }
      }
      
      results.push({
        id: msg.id,
        msg_code: msg.msg_code,
        title: msg.msg_title,
        eligible,
        requirements,
        requirementsMet
      });
    }
    
    return NextResponse.json({
      userId,
      fid,
      totalUnreceived: unreceived.length,
      eligible: results.filter(r => r.eligible).length,
      messages: results
    });
  } catch (error: any) {
    console.error('Error checking message eligibility:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
