import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      [user.id]
    );

    return NextResponse.json(subnetRows);
  } catch (err: any) {
    console.error('Subnets API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch subnets' },
      { status: 500 }
    );
  }
}
