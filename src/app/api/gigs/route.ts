import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  const sort = searchParams.get('sort') || 'newest';

  if (!fid) {
    return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
  }

  const pool = await getDbPool();

  try {
    // Get user ID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    
    if (!userRows.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = userRows[0].id;

    // Query gigs with user's history
    let query, params;

    if (sort === 'contact') {
      // Sort by contact - show gigs from unlocked contacts
      query = `
        SELECT 
          g.id, g.gig_name as title, g.gig_desc as description,
          g.reward_item, g.reward_credits, g.contact,
          c.display_name as contact_name,
          c.image_url as contact_image_url,
          gr.req_1, gr.req_2, gr.req_3,
          gh.status,
          gh.last_completed_at,
          gh.completed_count,
          gh.unlocked_at
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_history gh ON g.id = gh.gig_id AND gh.user_id = ?
        LEFT JOIN contacts c ON g.contact = c.id
        WHERE gh.status = 'UNLOCKED' OR gh.last_completed_at IS NOT NULL
        ORDER BY g.contact, g.id DESC
      `;
      params = [userId];
    } else {
      // Default - show all unlocked gigs for this user
      query = `
        SELECT 
          g.id, g.gig_name as title, g.gig_desc as description,
          g.reward_item, g.reward_credits, g.contact,
          c.display_name as contact_name,
          c.image_url as contact_image_url,
          gr.req_1, gr.req_2, gr.req_3,
          gh.status,
          gh.last_completed_at,
          gh.completed_count,
          gh.unlocked_at
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_history gh ON g.id = gh.gig_id AND gh.user_id = ?
        LEFT JOIN contacts c ON g.contact = c.id
        WHERE gh.status = 'UNLOCKED' OR gh.last_completed_at IS NOT NULL
        ORDER BY g.id DESC
        LIMIT 100
      `;
      params = [userId];
    }

    const [rows] = await pool.execute(query, params);

    return NextResponse.json({ 
      gigs: rows,
      sort 
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    return NextResponse.json({ error: 'Failed to fetch gigs' }, { status: 500 });
  }
}
