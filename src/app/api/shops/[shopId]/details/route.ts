import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { getUserIdByFid } from '../../../../../lib/api/userUtils';
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

    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    const userId = await getUserIdByFid(pool, fid.toString());

    // Verify user has unlocked this shop
    const [accessRows] = await pool.execute<any[]>(
      `SELECT poi_id FROM user_zone_history 
       WHERE user_id = ? AND poi_id = ? AND action_type = 'UnlockedPOI' 
       LIMIT 1`,
      [userId, shopId]
    );

    if (accessRows.length === 0) {
      return NextResponse.json({ error: 'Shop not unlocked' }, { status: 403 });
    }

    // Get shop details from points_of_interest
    const [shopRows] = await pool.execute<any[]>(
      `SELECT 
        poi.id,
        poi.name,
        poi.poi_type,
        poi.description,
        poi.image_url,
        poi.zone_id,
        poi.subnet_id,
        poi.shopkeeper_name,
        poi.shopkeeper_quote,
        z.name as zone_name
       FROM points_of_interest poi
       LEFT JOIN zones z ON poi.zone_id = z.id
       WHERE poi.id = ? AND poi.poi_type = 'shop'
       LIMIT 1`,
      [shopId]
    );

    const shop = (shopRows as any[])[0];

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Determine shop type based on location
    let shop_type: 'physical' | 'virtual' | 'protocol' = 'physical';
    if (shop.subnet_id) {
      shop_type = 'virtual';
    } else if (!shop.zone_id && !shop.subnet_id) {
      shop_type = 'protocol';
    }

    return NextResponse.json({
      id: shop.id,
      name: shop.name,
      shop_type,
      description: shop.description || 'A shop in the zone',
      shopkeeper_name: shop.shopkeeper_name,
      shopkeeper_quote: shop.shopkeeper_quote,
      image_url: shop.image_url,
      zone_id: shop.zone_id,
      zone_name: shop.zone_name,
      subnet_id: shop.subnet_id
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch shop details');
  }
}
