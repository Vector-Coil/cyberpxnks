import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);
    const itemId = parseInt(id, 10);

    if (Number.isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
    }

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

    // Fetch item details
    const [itemRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.callout,
        i.credits_cost,
        i.is_stackable,
        i.is_equippable,
        i.is_consumable,
        i.required_level,
        i.model,
        i.tier,
        i.image_url
      FROM items i
      WHERE i.id = ?
      LIMIT 1`,
      [itemId]
    );

    const item = (itemRows as any[])[0];
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if user owns this item
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT quantity, acquired_at, upgrade
       FROM user_inventory
       WHERE user_id = ? AND item_id = ?
       LIMIT 1`,
      [user.id, itemId]
    );
    const inventoryItem = (inventoryRows as any[])[0];

    // Check if item is equipped
    const [loadoutRows] = await pool.execute<any[]>(
      `SELECT slot_name, slot_type
       FROM user_loadout
       WHERE user_id = ? AND item_id = ?
       LIMIT 1`,
      [user.id, itemId]
    );
    const loadoutItem = (loadoutRows as any[])[0];

    return NextResponse.json({
      item,
      owned: !!inventoryItem,
      quantity: inventoryItem?.quantity || 0,
      acquired_at: inventoryItem?.acquired_at || null,
      is_equipped: !!loadoutItem,
      slot_name: loadoutItem?.slot_name || null,
      slot_type: loadoutItem?.slot_type || null,
      upgrade: inventoryItem?.upgrade || 0
    });
  } catch (err: any) {
    console.error('Item detail API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch item details' },
      { status: 500 }
    );
  }
}
