/**
 * Fetch user row by Farcaster FID
 */
export async function getUserByFid(fid: number): Promise<any | null> {
  const pool = await getDbPool();
  const [userRows] = await pool.execute<any[]>(
    'SELECT id, username, credits, pfp_url FROM users WHERE fid = ? LIMIT 1',
    [fid]
  );
  return (userRows as any[])[0] || null;
}
import { getDbPool } from './db';

/**
 * Fetch user data for NavStrip component
 * @param fid - User's Farcaster ID (defaults to test user 300187)
 * @returns User data object with username, profileImage, and credits
 */
export async function getNavStripData(fid: number = 300187): Promise<{
  username: string;
  profileImage?: string;
  credits: number;
}> {
  try {
    const pool = await getDbPool();
    // Get user row
    const [userRows] = await pool.execute<any[]>(
      'SELECT id, username, credits, pfp_url FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      return {
        username: 'user',
        profileImage: undefined,
        credits: 0
      };
    }
    const userId = user.id;

    // --- GIG TRIGGER CHECK ---
    // 1. Get all gig_requirements and unlocked/started/completed gigs for this user
    const [gigReqRows] = await pool.execute<any[]>(
      'SELECT gr.gig_id, gr.req_1, gr.req_2, gr.req_3, gr.req_4, gr.req_5 FROM gig_requirements gr LEFT JOIN gig_history gh ON gr.gig_id = gh.gig_id AND gh.user_id = ? WHERE gh.id IS NULL',
      [userId]
    );
    // 2. For each gig, check if all req_* are satisfied
    for (const gig of gigReqRows as any[]) {
      let allMet = true;
      for (let i = 1; i <= 5; i++) {
        const req = gig[`req_${i}`];
        if (!req) continue;
        const [type, id] = req.split('_');
        if (!type || !id) { allMet = false; break; }
        if (type === 'contact') {
          const [rows] = await pool.execute('SELECT 1 FROM contact_history WHERE user_id = ? AND contact_id = ? AND status = \'unlocked\' LIMIT 1', [userId, id]);
          if (!(rows as any[]).length) { allMet = false; break; }
        } else if (type === 'gig') {
          const [rows] = await pool.execute('SELECT 1 FROM gig_history WHERE user_id = ? AND gig_id = ? AND (status = \'complete\' OR status = \'completed\') LIMIT 1', [userId, id]);
          if (!(rows as any[]).length) { allMet = false; break; }
        } else if (type === 'item') {
          const [rows] = await pool.execute('SELECT 1 FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1', [userId, id]);
          if (!(rows as any[]).length) { allMet = false; break; }
        } else {
          // Future: handle class_x, statname_y, etc
          allMet = false; break;
        }
      }
      // 3. If all requirements met, insert into gig_history as unlocked
      if (allMet) {
        await pool.execute(
          'INSERT INTO gig_history (user_id, gig_id, status, unlocked_at, completed_count) VALUES (?, ?, \'unlocked\', NOW(), 0)',
          [userId, gig.gig_id]
        );
      }
    }

    // --- END GIG TRIGGER CHECK ---
    return {
      username: user.username || 'user',
      profileImage: user.pfp_url ? `${user.pfp_url}?t=${Date.now()}` : undefined,
      credits: user.credits || 0
    };
  } catch (err) {
    console.error('Failed to fetch NavStrip data:', err);
    return {
      username: 'user',
      profileImage: undefined,
      credits: 0
    };
  }
}
