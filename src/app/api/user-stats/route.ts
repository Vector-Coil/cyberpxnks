import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid } from '~/lib/api/errors';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  try {
    const dbPool = await getDbPool();

    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT cognition, insight, interface, power, resilience, agility, unallocated_points FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    logger.info('Retrieved user stats', { fid });
    return NextResponse.json(userRows[0]);
  } catch (error) {
    return handleApiError(error, '/api/user-stats');
  }
}
