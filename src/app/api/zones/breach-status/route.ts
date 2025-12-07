import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;
    const poiIdParam = searchParams.get('poiId');
    const poiId = poiIdParam ? parseInt(poiIdParam, 10) : null;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check for active breach (optionally filtered by POI)
    // Include both in-progress (end_time > now) and completed but unprocessed (end_time <= now, result_status IS NULL or empty string)
    let query = `SELECT id, zone_id, action_type, timestamp, end_time, result_status, poi_id
                 FROM user_zone_history
                 WHERE user_id = ? AND action_type = 'Breached' AND (result_status IS NULL OR result_status = '')`;
    const params: any[] = [user.id];

    if (poiId) {
      query += ' AND (poi_id = ? OR poi_id IS NULL)';
      params.push(poiId);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1';

    console.log('Breach status query:', { query, params, userId: user.id, requestedPoiId: poiId });

    const [breachRows] = await pool.execute<any[]>(query, params);

    console.log('Breach status query result:', { rowCount: breachRows.length, rows: breachRows });
    
    // Debug: Get ALL breaches to see what's there
    const [allBreaches] = await pool.execute<any[]>(
      `SELECT id, zone_id, poi_id, result_status, end_time 
       FROM user_zone_history 
       WHERE user_id = ? AND action_type = 'Breached' 
       ORDER BY timestamp DESC LIMIT 5`,
      [user.id]
    );
    console.log('All recent breaches:', allBreaches);

    if (breachRows.length === 0) {
      return NextResponse.json({ activeBreach: null });
    }

    const breach = breachRows[0];
    console.log('Found active breach:', breach);
    
    // Get POI name if we have an ID
    let poiName = null;
    if (breach.poi_id) {
      const [poiRows] = await pool.execute<any[]>(
        'SELECT name FROM points_of_interest WHERE id = ? LIMIT 1',
        [breach.poi_id]
      );
      if (poiRows.length > 0) {
        poiName = poiRows[0].name;
      }
    }
    
    return NextResponse.json({
      activeBreach: {
        id: breach.id,
        zone_id: breach.zone_id,
        poi_id: breach.poi_id,
        poi_name: poiName,
        action_type: breach.action_type,
        timestamp: breach.timestamp,
        end_time: breach.end_time
      }
    });
  } catch (err: any) {
    console.error('Breach status API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to check breach status' },
      { status: 500 }
    );
  }
}
