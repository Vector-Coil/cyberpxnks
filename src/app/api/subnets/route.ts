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
    const [subnetRows] = await pool.execute<any[]>(
      `SELECT 
        s.id,
        s.name,
        s.description,
        s.image_url,
        usa.unlocked_at,
        usa.unlock_method
       FROM subnets s
       INNER JOIN user_subnet_access usa ON s.id = usa.subnet_id
       WHERE usa.user_id = ?
       ORDER BY usa.unlocked_at DESC`,
      [userId]
    );

    logger.info('Retrieved subnets', { fid, count: subnetRows.length });
    return NextResponse.json(subnetRows);
  } catch (err: any) {
    return handleApiError(err, '/api/subnets');
  }
}
