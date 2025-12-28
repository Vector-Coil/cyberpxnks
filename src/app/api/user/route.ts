import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { getUserByFid } from '../../../lib/api/userUtils';
import { validateFid, handleApiError } from '../../../lib/api/errors';
import { logger } from '../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fid = validateFid(searchParams.get('fid'));

    logger.apiRequest('GET', '/api/user', { fid });

    const pool = await getDbPool();
    const user = await getUserByFid(pool, fid);

    return NextResponse.json({
      id: user.id,
      fid: user.fid,
      username: user.username,
      mirror_name: user.mirror_name,
      admin: user.admin
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/user');
  }
}
