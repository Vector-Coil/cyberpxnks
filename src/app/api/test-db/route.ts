import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '~/lib/logger';

export async function GET() {
  try {
    logger.info('Testing database connection');
    logger.debug('DB config', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    const pool = await getDbPool();
    
    // Try a simple query
    const [rows] = await pool.execute('SELECT 1 as test');
    
    logger.info('Database connection successful');
    
    return NextResponse.json({ 
      success: true,
      message: 'Database connection successful',
      testQuery: rows,
      config: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
      }
    });
  } catch (err: any) {
    logger.error('Database connection error', { error: err.message, code: err.code, sqlState: err.sqlState });
    return NextResponse.json({ 
      success: false,
      error: err.message,
      code: err.code,
      sqlState: err.sqlState,
      config: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
      }
    }, { status: 500 });
  }
}
