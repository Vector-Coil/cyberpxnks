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

    const contactQuery = `
      SELECT COUNT(*) AS cnt FROM contact_history ch
      JOIN users u ON ch.user_id = u.id
      WHERE u.fid = ?
        AND ch.unlocked_at >= (NOW() - INTERVAL 24 HOUR)
    `;

    const gigQuery = `
      SELECT COUNT(*) AS cnt FROM gig_history gh
      JOIN users u ON gh.user_id = u.id
      WHERE u.fid = ?
        AND gh.status = 'UNLOCKED'
        AND gh.last_completed_at IS NULL
    `;

    const messagesQuery = `
      SELECT COUNT(*) AS cnt FROM msg_history mh
      JOIN users u ON mh.user_id = u.id
      WHERE u.fid = ?
        AND mh.status = 'UNREAD'
    `;

    const unallocatedPointsQuery = `
      SELECT unallocated_points FROM users WHERE fid = ? LIMIT 1
    `;

    const [contactRows] = await pool.execute<any[]>(contactQuery, [fid]);
    const [gigRows] = await pool.execute<any[]>(gigQuery, [fid]);
    const [msgRows] = await pool.execute<any[]>(messagesQuery, [fid]);
    const [pointsRows] = await pool.execute<any[]>(unallocatedPointsQuery, [fid]);

    const contacts = (contactRows as any)[0]?.cnt ?? 0;
    const gigs = (gigRows as any)[0]?.cnt ?? 0;
    const messages = (msgRows as any)[0]?.cnt ?? 0;
    const unallocatedPoints = (pointsRows as any)[0]?.unallocated_points ?? 0;

    return NextResponse.json({ contacts, gigs, messages, unallocatedPoints });
  } catch (err) {
    console.error('/api/alerts error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
