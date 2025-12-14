import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET() {
  try {
    const pool = await getDbPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, name, description, image_url FROM classes ORDER BY id'
    );
    
    logger.info('Retrieved classes', { count: rows.length });
    return NextResponse.json(rows);
  } catch (err: any) {
    return handleApiError(err, '/api/classes');
  }
}
