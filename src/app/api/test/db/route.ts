import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '~/lib/db';
import { handleApiError } from '~/lib/api/errors';
import { logger } from '~/lib/logger';

export async function GET(req: NextRequest) {
  try {
    // Query your test table using the project's db pool
    const sql = 'SELECT * FROM users WHERE status = ?';
    const pool = await getDbPool();
    const [users] = await pool.query<any[]>(sql, ['active']);

    logger.debug('Test DB query executed', { count: Array.isArray(users) ? users.length : 0 });

    return NextResponse.json({
      success: true,
      users: users,
      count: Array.isArray(users) ? users.length : 0,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch users');
  }
}