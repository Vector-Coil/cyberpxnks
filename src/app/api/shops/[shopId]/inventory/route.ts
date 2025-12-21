import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { handleApiError } from '../../../../../lib/api/errors';
import { logger } from '../../../../../lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  try {
    const { shopId: shopIdParam } = await params;
    const shopId = parseInt(shopIdParam, 10);

    if (Number.isNaN(shopId)) {
      return NextResponse.json({ error: 'Invalid shop ID' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Admin shop (ID 4) - return ALL items from items table
    if (shopId === 4) {
      const [allItemsRows] = await pool.execute<any[]>(
        `SELECT 
          i.id as item_id,
          4 as shop_id,
          i.name,
          i.description,
          i.item_type,
          i.id,
          0 as price,
          'credits' as currency,
          -1 as stock,
          NULL as required_level,
          NULL as required_street_cred,
          i.image_url
         FROM items i
         ORDER BY i.item_type, i.name`
      );

      return NextResponse.json({
        items: allItemsRows,
        isAdminShop: true
      });
    }

    // Get shop inventory from shop_inventory table
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT 
        si.id,
        si.shop_id,
        si.name,
        si.description,
        si.item_type,
        si.item_id,
        si.price,
        si.currency,
        si.stock,
        si.required_level,
        si.required_street_cred,
        si.image_url
       FROM shop_inventory si
       WHERE si.shop_id = ? AND (si.stock > 0 OR si.stock = -1)
       ORDER BY si.item_type, si.price`,
      [shopId]
    );

    return NextResponse.json({
      items: inventoryRows
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch shop inventory');
  }
}
