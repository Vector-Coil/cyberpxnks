import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);
    const sortBy = searchParams.get('sortBy') || 'acquisition'; // acquisition, alphabetical, type

    const pool = await getDbPool();

    // Get user ID from fid
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      [user.id]
    );

    return NextResponse.json({ 
      items: inventoryRows,
      sortBy
    });
  } catch (err: any) {
    console.error('Inventory API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}
