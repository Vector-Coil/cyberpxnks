import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const poiIdParam = searchParams.get('poiId');
    const poiId = poiIdParam ? parseInt(poiIdParam, 10) : null;

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Check for active breach (optionally filtered by POI)
    // Return if:
    // 1. In progress or ready for results: result_status is NULL/empty (regardless of end_time)
    // 2. NOT if already viewed (result_status = 'completed') - those should be dismissed first
    let query = `SELECT id, zone_id, action_type, timestamp, end_time, result_status, poi_id
                 FROM user_zone_history
                 WHERE user_id = ? 
                 AND action_type = 'Breached' 
                 AND result_status != 'dismissed'
                 AND (result_status IS NULL OR result_status = '')`;
    const params: any[] = [userId];

    if (poiId) {
      query += ' AND (poi_id = ? OR poi_id IS NULL)';
      params.push(poiId);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1';

    logger.debug('Breach status query', { fid, userId, poiId });

    const [breachRows] = await pool.execute<any[]>(query, params);

    logger.debug('Breach status result', { fid, rowCount: breachRows.length });
    
    // Debug: Get ALL breaches to see what's there
    const [allBreaches] = await pool.execute<any[]>(
      `SELECT id, zone_id, poi_id, result_status, end_time 
       FROM user_zone_history 
       WHERE user_id = ? AND action_type = 'Breached' 
       ORDER BY timestamp DESC LIMIT 5`,
      [userId]
    );
    logger.debug('All recent breaches', { fid, breaches: allBreaches });
    const breach = breachRows[0];
    logger.debug('Found active breach', { fid, breachId: breach.id });
    
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
    return handleApiError(err, 'Failed to check breach status');
  }
}
