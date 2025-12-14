import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET() {
  try {
    const pool = await getDbPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, name, description FROM alignments ORDER BY id'
    );
    
    logger.info('Retrieved alignments', { count: rows.length });
    return NextResponse.json(rows);
  } catch (err: any) {
    return handleApiError(err, '/api/alignments');
  }
}
