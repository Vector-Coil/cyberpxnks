import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  const sort = searchParams.get('sort') || 'newest';
  const contactId = searchParams.get('contact_id');

  if (!fid) {
    return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
  }

  const pool = await getDbPool();

  try {
    // Get user ID
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    
    if (!(userRows as any).length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = (userRows as any)[0].id;

    // Build query based on sort/filter options
    let query = `
      SELECT 
        m.id,
        m.subject,
        m.body,
        m.contact AS contact_id,
        c.display_name AS contact_name,
        c.image_url AS contact_image_url,
        mh.status,
        mh.received_at
      FROM msg_history mh
      JOIN messages m ON mh.msg_id = m.id
      JOIN contacts c ON m.contact = c.id
      WHERE mh.user_id = ?
    `;
    
    const params: any[] = [userId];

    // Filter by contact if specified
    if (contactId) {
      query += ' AND m.contact = ?';
      params.push(parseInt(contactId, 10));
    }

    // Sort order
    if (sort === 'contact') {
      query += ' ORDER BY c.display_name ASC, mh.received_at DESC';
    } else {
      // Default: newest first
      query += ' ORDER BY mh.received_at DESC';
    }

    query += ' LIMIT 200';

    const [rows] = await pool.execute(query, params);

    return NextResponse.json({ 
      messages: rows,
      sort,
      contactId: contactId || null
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
