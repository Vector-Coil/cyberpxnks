import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Fetch discovered subnets for this user
    // Include both:
    // 1. Subnets user has explicitly unlocked (user_subnet_access)
    // 2. Subnets with default access (is_default_access = 1)
    const [subnetRows] = await pool.execute<any[]>(
      `SELECT 
        s.id,
        s.name,
        s.description,
        s.image_url,
        COALESCE(usa.unlocked_at, NOW()) as unlocked_at,
        COALESCE(usa.unlock_method, 'default_access') as unlock_method
       FROM subnets s
       LEFT JOIN user_subnet_access usa ON s.id = usa.subnet_id AND usa.user_id = ?
       WHERE usa.user_id IS NOT NULL OR s.is_default_access = 1
       ORDER BY unlocked_at DESC`,
      [userId]
    );

    logger.info('Retrieved subnets', { fid, count: subnetRows.length });
    return NextResponse.json(subnetRows);
  } catch (err: any) {
    return handleApiError(err, '/api/subnets');
  }
}
