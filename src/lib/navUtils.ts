import { getDbPool } from './db';

/**
 * Fetch user data for NavStrip component
 * @param fid - User's Farcaster ID (defaults to test user 300187)
 * @returns User data object with username, profileImage, and cxBalance
 */
export async function getNavStripData(fid: number = 300187): Promise<{
  username: string;
  profileImage?: string;
  cxBalance: number;
}> {
  try {
    const pool = await getDbPool();
    const [userRows] = await pool.execute<any[]>(
      'SELECT username, credits, pfp_url FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];
    
    if (!user) {
      return {
        username: 'user',
        profileImage: undefined,
        cxBalance: 0
      };
    }

    return {
      username: user.username || 'user',
      profileImage: user.pfp_url ? `${user.pfp_url}?t=${Date.now()}` : undefined,
      cxBalance: user.credits || 0
    };
  } catch (err) {
    console.error('Failed to fetch NavStrip data:', err);
    return {
      username: 'user',
      profileImage: undefined,
      cxBalance: 0
    };
  }
}
