import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '~/lib/db';

let connectionParams = {
host: 'localhost',
//port: 3306,
user: 'nickpasq_nick',
password: 'Retrowave.123',
database: 'nickpasq_cx'
}

export async function GET(req: NextRequest) {
  try {
    // Query your test table using the project's db pool
    const sql = 'SELECT * FROM users WHERE status = ?';
    const pool = await getDbPool();
    const [users] = await pool.query<any[]>(sql, ['active']);

    return NextResponse.json({
      success: true,
      users: users,
      count: Array.isArray(users) ? users.length : 0,
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}