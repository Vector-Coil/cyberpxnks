import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zone: string }> }
) {
  try {
    const { zone: zoneParam } = await params;
    const zoneId = parseInt(zoneParam, 10);
    
    if (Number.isNaN(zoneId)) {
      return NextResponse.json({ error: 'Invalid zone ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID and location from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id, location FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch zone details
    const [zoneRows] = await pool.execute<any[]>(
      `SELECT z.id, z.name, z.zone_type, z.description, z.image_url, zt.name as zone_type_name, zd.name as district_name
       FROM zones z
       LEFT JOIN zone_type zt ON z.zone_type = zt.id
       LEFT JOIN zone_districts zd ON z.district = zd.id
       WHERE z.id = ? LIMIT 1`,
      [zoneId]
    );
    const zone = (zoneRows as any[])[0];

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Fetch user's zone history
    const [historyRows] = await pool.execute<any[]>(
      `SELECT id, action_type, timestamp, end_time, result_status, gains_data, xp_data, poi_id
       FROM user_zone_history
       WHERE user_id = ? AND zone_id = ?
       ORDER BY timestamp DESC
       LIMIT 20`,
      [user.id, zoneId]
    );

    // Fetch unlocked POI for this zone (via user_zone_history)
    const [poiRows] = await pool.execute<any[]>(
      `SELECT DISTINCT poi.id, poi.zone_id, poi.name, poi.poi_type, poi.subnet_id, poi.description, 
              poi.breach_difficulty, poi.image_url, uzh.timestamp as unlocked_at, 'scout' as unlock_method
       FROM points_of_interest poi
       INNER JOIN user_zone_history uzh ON poi.id = uzh.poi_id
       WHERE uzh.user_id = ? AND poi.zone_id = ? AND uzh.action_type = 'UnlockedPOI'
       ORDER BY uzh.timestamp DESC`,
      [user.id, zoneId]
    );

    console.log('POI data from DB:', poiRows.map((p: any) => ({ id: p.id, name: p.name, poi_type: p.poi_type, image_url: p.image_url })));

    return NextResponse.json({
      zone,
      history: historyRows,
      poi: poiRows,
      userLocation: user.location
    });
  } catch (err: any) {
    console.error('Zone detail API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch zone details' },
      { status: 500 }
    );
  }
}
