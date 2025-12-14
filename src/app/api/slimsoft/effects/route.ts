import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { handleApiError } from '../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { logger } from '../../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);
    const itemIds = searchParams.get('itemIds'); // Comma-separated list of item IDs

    const pool = await getDbPool();

    const userId = await getUserIdByFid(pool, fid.toString());

    let query = `
      SELECT 
        se.item_id,
        se.effect_name,
        se.effect_type,
        se.available_at,
        se.target_stat,
        se.effect_value,
        se.is_percentage,
        se.description,
        i.name as slimsoft_name,
        i.image_url as slimsoft_image_url
      FROM slimsoft_effects se
      INNER JOIN items i ON se.item_id = i.id
    `;

    let params: any[] = [];

    // If specific item IDs are requested, filter by them
    if (itemIds) {
      const ids = itemIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        query += ` WHERE se.item_id IN (${ids.map(() => '?').join(',')})`;
        params = ids;
      }
    }

    query += ` ORDER BY se.item_id, se.effect_name`;

    const [effectRows] = await pool.execute<any[]>(query, params);

    return NextResponse.json({
      effects: effectRows
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch slimsoft effects');
  }
}
