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
    const historyIdParam = searchParams.get('historyId');
    const historyId = historyIdParam ? parseInt(historyIdParam, 10) : null;

    if (!historyId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Get breach details including POI ID
    const [breachRows] = await pool.execute<any[]>(
      `SELECT id, zone_id, poi_id, action_type, timestamp, end_time, result_status
       FROM user_zone_history
       WHERE id = ? AND user_id = ? LIMIT 1`,
      [historyId, userId]
    );

    if (breachRows.length === 0) {
      return NextResponse.json({ error: 'Breach not found' }, { status: 404 });
    }

    const breach = breachRows[0];
    
    logger.info('Retrieved breach detail', { fid, historyId, poiId: breach.poi_id });
    return NextResponse.json({
      id: breach.id,
      zone_id: breach.zone_id,
      poi_id: breach.poi_id,
      action_type: breach.action_type,
      timestamp: breach.timestamp,
      end_time: breach.end_time,
      result_status: breach.result_status
    });
  } catch (err: any) {
    return handleApiError(err, '/api/zones/breach-detail');
  }
}
