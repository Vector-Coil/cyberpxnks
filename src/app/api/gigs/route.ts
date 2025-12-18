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
    // Get gigs based on sort order
    let query, params;

    if (sort === 'contact') {
      query = `
        SELECT 
          g.id, g.title, g.description, g.reward,
          g.posted_at, g.state,
          gp.post_fid, gp.is_active,
          u.username as posted_by_username,
          u.pfp_url as posted_by_pfp,
          u.username as posted_by_display_name,
          gr.item1_name, gr.item1_qty,
          gr.item2_name, gr.item2_qty,
          gr.item3_name, gr.item3_qty,
          CASE 
            WHEN gc.fid IS NOT NULL THEN 'claimed'
            WHEN gp.post_fid IS NULL THEN 'not_posted'
            WHEN gp.is_active = false THEN 'inactive'
            ELSE 'available'
          END as status
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_posts gp ON g.id = gp.gig_id
        LEFT JOIN users u ON gp.post_fid = u.fid
        LEFT JOIN gig_claims gc ON g.id = gc.gig_id AND gc.claimed_by_fid = ?
        WHERE u.fid IN (
          SELECT target_fid FROM contacts WHERE source_fid = ?
        ) OR g.id IN (
          SELECT gig_id FROM gig_claims WHERE claimed_by_fid = ?
        )
        ORDER BY FIELD(status, 'available', 'not_posted', 'inactive', 'claimed'), g.posted_at DESC
      `;
      params = [fid, fid, fid];
    } else {
      query = `
        SELECT 
          g.id, g.title, g.description, g.reward,
          g.posted_at, g.state,
          gp.post_fid, gp.is_active,
          u.username as posted_by_username,
          u.pfp_url as posted_by_pfp,
          u.username as posted_by_display_name,
          gr.item1_name, gr.item1_qty,
          gr.item2_name, gr.item2_qty,
          gr.item3_name, gr.item3_qty,
          CASE 
            WHEN gc.fid IS NOT NULL THEN 'claimed'
            WHEN gp.post_fid IS NULL THEN 'not_posted'
            WHEN gp.is_active = false THEN 'inactive'
            ELSE 'available'
          END as status
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_posts gp ON g.id = gp.gig_id
        LEFT JOIN users u ON gp.post_fid = u.fid
        LEFT JOIN gig_claims gc ON g.id = gc.gig_id AND gc.claimed_by_fid = ?
        ORDER BY g.posted_at DESC
        LIMIT 100
      `;
      params = [fid];
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
