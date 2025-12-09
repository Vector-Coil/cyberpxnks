import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET() {
  try {
    console.log('Testing database connection...');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_PORT:', process.env.DB_PORT);
    
    const pool = await getDbPool();
    
    // Try a simple query
    const [rows] = await pool.execute('SELECT 1 as test');
    
    console.log('Database connection successful!');
    
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
    console.error('Database connection error:', err);
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
