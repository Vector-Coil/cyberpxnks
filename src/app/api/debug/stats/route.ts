import { NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

// Debug endpoint to check raw user data
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fidParam = url.searchParams.get('fid') || '300187';
    const fid = parseInt(fidParam, 10);

    const pool = await getDbPool();
    
    const userId = await getUserIdByFid(pool, fid);

    // Get user attributes
    const [attrRows] = await pool.execute(
      `SELECT 
        u.cognition, u.insight, u.interface, u.power, u.resilience, u.agility,
        u.class_id,
        c.class_clock_speed, c.class_cooling, c.class_signal_noise,
        c.class_latency, c.class_decryption, c.class_cache
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    // Get user_stats
    const [statsRows] = await pool.execute(
      `SELECT * FROM user_stats WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    // Get equipment
    const [equipRows] = await pool.execute(
      `SELECT * FROM user_equipment_summary WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    return NextResponse.json({
      userId,
      userAttributes: (attrRows as any[])[0] || null,
      userStats: (statsRows as any[])[0] || null,
      equipment: (equipRows as any[])[0] || null
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch debug stats');
  }
}
