import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';

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
    console.error('Shop inventory API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch shop inventory' },
      { status: 500 }
    );
  }
}
