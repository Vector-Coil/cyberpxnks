import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

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

    const userId = await getUserIdByFid(pool, fid);

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

    // Check if user owns this item and sum quantities across all rows
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT 
        SUM(quantity) as quantity, 
        MIN(acquired_at) as acquired_at, 
        MAX(upgrade) as upgrade
       FROM user_inventory
       WHERE user_id = ? AND item_id = ?
       GROUP BY user_id, item_id`,
      [userId, itemId]
    );
    const inventoryItem = (inventoryRows as any[])[0];

    logger.info('Item detail fetch', {
      itemId,
      userId,
      hasInventoryItem: !!inventoryItem,
      quantity: inventoryItem?.quantity || 0,
      quantityType: typeof inventoryItem?.quantity
    });

    // Check if item is equipped
    const [loadoutRows] = await pool.execute<any[]>(
      `SELECT slot_name, slot_type
       FROM user_loadout
       WHERE user_id = ? AND item_id = ?
       LIMIT 1`,
      [userId, itemId]
    );
    const loadoutItem = (loadoutRows as any[])[0];

    return NextResponse.json({
      item,
      owned: !!inventoryItem,
      quantity: inventoryItem ? parseInt(inventoryItem.quantity, 10) || 0 : 0,
      acquired_at: inventoryItem?.acquired_at || null,
      is_equipped: !!loadoutItem,
      slot_name: loadoutItem?.slot_name || null,
      slot_type: loadoutItem?.slot_type || null,
      upgrade: inventoryItem?.upgrade || 0
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch item details');
  }
}
