import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET() {
  try {
    const pool = await getDbPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, name, description, image_url FROM classes ORDER BY id'
    );
    
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error('Classes API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}
