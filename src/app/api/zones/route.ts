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

    // Fetch discovered zones for this user
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT DISTINCT z.id, z.name, z.zone_type, z.description, z.image_url, zt.name as zone_type_name, zd.name as district_name
       FROM zones z
       INNER JOIN user_zone_history uzh ON z.id = uzh.zone_id
       LEFT JOIN zone_type zt ON z.zone_type = zt.id
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE uzh.user_id = ?
       ORDER BY z.name`,
      [user.id]
    );

    console.log('Zone rows from DB:', JSON.stringify(zoneRows, null, 2));
    return NextResponse.json(zoneRows);
  } catch (err: any) {
    console.error('Zones API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch zones' },
      { status: 500 }
    );
  }
}
