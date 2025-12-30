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

    // First, unlock any scheduled messages that are due for delivery
    // This ensures junk messages and other scheduled messages are delivered
    // when the user loads any page (dashboard, city, etc.), not just the messages page
    try {
      const [updateResult] = await pool.execute(
        `UPDATE msg_history 
         SET status = 'UNREAD', unlocked_at = NOW() 
         WHERE user_id = ? 
         AND status = 'SCHEDULED' 
         AND scheduled_for <= NOW()`,
        [userId]
      );
      const unlocked = (updateResult as any).affectedRows;
      if (unlocked > 0) {
        logger.info(`Unlocked ${unlocked} scheduled message(s) for user ${userId}`);
      }
    } catch (unlockErr) {
      logger.error('Error unlocking scheduled messages in alerts endpoint:', unlockErr);
      // Continue anyway - don't block alert fetching
    }

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

    const locationQuery = `
      SELECT 
        u.location as current_zone_id,
        z.name AS zone_name,
        zt.image_url AS zone_image
      FROM users u
      LEFT JOIN zones z ON u.location = z.id
      LEFT JOIN zone_type zt ON z.zone_type = zt.id
      WHERE u.id = ?
      LIMIT 1
    `;

    const [contactRows] = await pool.execute<any[]>(contactQuery, [userId]);
    const [gigRows] = await pool.execute<any[]>(gigQuery, [userId]);
    const [msgRows] = await pool.execute<any[]>(messagesQuery, [userId]);
    const [pointsRows] = await pool.execute<any[]>(unallocatedPointsQuery, [userId]);
    const [locationRows] = await pool.execute<any[]>(locationQuery, [userId]);

    const contacts = (contactRows as any)[0]?.cnt ?? 0;
    const gigs = (gigRows as any)[0]?.cnt ?? 0;
    const messages = (msgRows as any)[0]?.cnt ?? 0;
    const unallocatedPoints = (pointsRows as any)[0]?.unallocated_points ?? 0;
    const location = (locationRows as any)[0] || null;

    logger.info('Retrieved alerts', { fid, contacts, gigs, messages, unallocatedPoints, location });
    
    // Build location object only if we have valid data
    let locationData = null;
    if (location && location.current_zone_id) {
      locationData = {
        zoneId: location.current_zone_id,
        zoneName: location.zone_name || 'Unknown Zone',
        zoneImage: location.zone_image || ''
      };
    }
    
    return NextResponse.json({ 
      contacts, 
      gigs, 
      messages, 
      unallocatedPoints,
      location: locationData
    });
  } catch (err) {
    return handleApiError(err, '/api/alerts');
  }
}
