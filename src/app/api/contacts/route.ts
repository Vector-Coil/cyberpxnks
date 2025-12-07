import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fidParam = url.searchParams.get('fid') || '300187';
    const fid = parseInt(fidParam, 10);

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    const pool = await getDbPool();

    const query = `
      SELECT c.id AS contact_id, c.display_name AS contact_name, c.image_url AS image_url, ch.unlocked_at,
        (
          SELECT COUNT(*) FROM gig_history gh
          JOIN gigs g ON gh.gig_id = g.id
          WHERE gh.user_id = u.id AND g.contact = c.id
            AND gh.status = 'UNLOCKED' AND gh.last_completed_at IS NULL
        ) AS gigs_count,
        (
          SELECT COUNT(*) FROM msg_history mh
          JOIN messages m ON mh.msg_id = m.id
          WHERE mh.user_id = u.id AND m.contact = c.id
            AND mh.status = 'UNREAD'
        ) AS messages_count
      FROM contact_history ch
      JOIN users u ON ch.user_id = u.id
      JOIN contacts c ON ch.contact_id = c.id
      WHERE u.fid = ?
      ORDER BY ch.unlocked_at DESC
    `;

    const [rows] = await pool.execute<any[]>(query, [fid]);

    return NextResponse.json(rows.map(r => ({
      id: r.contact_id,
      name: r.contact_name,
      image_url: r.image_url,
      unlocked_at: r.unlocked_at,
      gigs: r.gigs_count ?? 0,
      messages: r.messages_count ?? 0,
      intel: 0,
    })));

  } catch (err) {
    console.error('/api/contacts error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
