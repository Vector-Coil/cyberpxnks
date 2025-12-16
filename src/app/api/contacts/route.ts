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

    const query = `
      SELECT c.id AS contact_id, c.display_name AS contact_name, c.image_url AS image_url, ch.unlocked_at,
        (
          SELECT COUNT(*) FROM gig_history gh
          JOIN gigs g ON gh.gig_id = g.id
          WHERE gh.user_id = ? AND g.contact = c.id
            AND gh.status = 'UNLOCKED' AND gh.last_completed_at IS NULL
        ) AS gigs_count,
        (
          SELECT COUNT(*) FROM msg_history mh
          JOIN messages m ON mh.msg_id = m.id
          WHERE mh.user_id = ? AND m.contact = c.id
            AND mh.status = 'UNREAD'
        ) AS messages_count
      FROM contact_history ch
      JOIN contacts c ON ch.contact_id = c.id
      WHERE ch.user_id = ?
      ORDER BY ch.unlocked_at DESC
    `;

    const [rows] = await pool.execute<any[]>(query, [userId, userId, userId]);
    logger.info('Retrieved contacts', { fid, count: rows.length });

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
    return handleApiError(err, '/api/contacts');
  }
}
