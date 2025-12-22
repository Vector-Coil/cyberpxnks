import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid, handleApiError } from '../../../lib/api/errors';
import { getUserIdByFid } from '../../../lib/api/userUtils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = validateFid(searchParams.get('fid'));
    const sort = searchParams.get('sort') || 'newest';
    const contactId = searchParams.get('contact_id');

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Build query based on sort/filter options
    // Union query to get both regular messages and junk messages
    let query = `
      SELECT 
        m.id,
        m.msg_code,
        m.msg_title AS subject,
        m.msg_body AS body,
        m.contact AS contact_id,
        m.image_url AS message_image_url,
        m.btn_1,
        m.btn_2,
        c.display_name AS contact_name,
        c.image_url AS contact_image_url,
        mh.status,
        mh.unlocked_at,
        mh.read_at,
        mh.msg_type
      FROM msg_history mh
      JOIN messages m ON mh.msg_id = m.id AND mh.msg_type = 'message'
      LEFT JOIN contacts c ON m.contact = c.id
      WHERE mh.user_id = ?
      
      UNION ALL
      
      SELECT 
        mj.id,
        mj.msg_code,
        mj.msg_title AS subject,
        mj.msg_body AS body,
        NULL AS contact_id,
        mj.image_url AS message_image_url,
        mj.btn_1,
        mj.btn_2,
        mj.sent_from AS contact_name,
        NULL AS contact_image_url,
        mh2.status,
        mh2.unlocked_at,
        mh2.read_at,
        mh2.msg_type
      FROM msg_history mh2
      JOIN messages_junk mj ON mh2.msg_id = mj.id AND mh2.msg_type = 'junk'
      WHERE mh2.user_id = ?
    `;
    
    const params: any[] = [userId, userId];

    // Wrap in subquery if we need to filter or sort
    let finalQuery = `SELECT * FROM (${query}) AS all_messages WHERE 1=1`;

    // Filter by contact if specified
    if (contactId) {
      finalQuery += ' AND contact_id = ?';
      params.push(parseInt(contactId, 10));
    }

    // Sort order
    if (sort === 'contact') {
      finalQuery += ' ORDER BY contact_name ASC, unlocked_at DESC';
    } else {
      // Default: newest first
      finalQuery += ' ORDER BY unlocked_at DESC';
    }

    finalQuery += ' LIMIT 200';

    const [rows] = await pool.execute(finalQuery, params);

    return NextResponse.json({ 
      messages: rows,
      sort,
      contactId: contactId || null
    });
  } catch (error: any) {
    return handleApiError(error, 'Failed to fetch messages');
  }
}
