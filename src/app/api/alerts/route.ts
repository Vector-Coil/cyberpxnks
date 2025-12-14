import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fid = validateFid(url.searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    const contactQuery = `
      SELECT COUNT(*) AS cnt FROM contact_history ch
      WHERE ch.user_id = ?
        AND ch.unlocked_at >= (NOW() - INTERVAL 24 HOUR)
    `;

    const gigQuery = `
      SELECT COUNT(*) AS cnt FROM gig_history gh
      WHERE gh.user_id = ?
        AND gh.status = 'UNLOCKED'
        AND gh.last_completed_at IS NULL
    `;

    const messagesQuery = `
      SELECT COUNT(*) AS cnt FROM msg_history mh
      WHERE mh.user_id = ?
        AND mh.status = 'UNREAD'
    `;

    const unallocatedPointsQuery = `
      SELECT unallocated_points FROM users WHERE id = ? LIMIT 1
    `;

    const [contactRows] = await pool.execute<any[]>(contactQuery, [userId]);
    const [gigRows] = await pool.execute<any[]>(gigQuery, [userId]);
    const [msgRows] = await pool.execute<any[]>(messagesQuery, [userId]);
    const [pointsRows] = await pool.execute<any[]>(unallocatedPointsQuery, [userId]);

    const contacts = (contactRows as any)[0]?.cnt ?? 0;
    const gigs = (gigRows as any)[0]?.cnt ?? 0;
    const messages = (msgRows as any)[0]?.cnt ?? 0;
    const unallocatedPoints = (pointsRows as any)[0]?.unallocated_points ?? 0;

    logger.info('Retrieved alerts', { fid, contacts, gigs, messages, unallocatedPoints });
    return NextResponse.json({ contacts, gigs, messages, unallocatedPoints });
  } catch (err) {
    return handleApiError(err, '/api/alerts');
  }
}
