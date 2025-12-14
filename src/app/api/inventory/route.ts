import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const sortBy = searchParams.get('sortBy') || 'acquisition'; // acquisition, alphabetical, type

    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Build ORDER BY clause based on sortBy parameter
    let orderBy = 'ui.acquired_at DESC'; // default: acquisition order
    if (sortBy === 'alphabetical') {
      orderBy = 'i.name ASC';
    } else if (sortBy === 'type') {
      orderBy = 'i.item_type ASC, i.name ASC';
    }

    // Fetch inventory with equipped status
    // For stackable items, sum quantities and group by item_id
    // For non-stackable items, return individual rows
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.credits_cost,
        i.is_stackable,
        i.is_equippable,
        i.is_consumable,
        i.required_level,
        i.model,
        i.tier,
        i.image_url,
        SUM(ui.quantity) as quantity,
        MIN(ui.acquired_at) as acquired_at,
        MAX(CASE WHEN ul.item_id IS NOT NULL THEN 1 ELSE 0 END) as is_equipped,
        MAX(ui.upgrade) as upgrade
      FROM user_inventory ui
      INNER JOIN items i ON ui.item_id = i.id
      LEFT JOIN user_loadout ul ON ul.user_id = ui.user_id AND ul.item_id = i.id
      WHERE ui.user_id = ?
      GROUP BY i.id, i.name, i.item_type, i.description, i.credits_cost, 
               i.is_stackable, i.is_equippable, i.is_consumable, 
               i.required_level, i.model, i.tier, i.image_url
      ORDER BY ${orderBy}`,
      [userId]
    );

    logger.info('Retrieved inventory', { fid, itemCount: inventoryRows.length, sortBy });
    return NextResponse.json({ 
      items: inventoryRows,
      sortBy
    });
  } catch (err: any) {
    return handleApiError(err, '/api/inventory');
  }
}
