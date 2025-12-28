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

    // Get user ID for per-user stock calculations
    const fidParam = request.nextUrl.searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : null;
    
    let userId = null;
    if (fid) {
      const [userRows] = await pool.execute<any[]>(
        'SELECT id FROM users WHERE fid = ? LIMIT 1',
        [fid]
      );
      userId = (userRows as any[])[0]?.id;
    }

    // Get shop inventory from shop_inventory table
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT 
        si.id,
        si.shop_id,
        si.item_id,
        si.price,
        si.stock,
        si.stock_replenish,
        si.required_level,
        si.required_street_cred,
        i.name,
        i.description,
        i.item_type,
        i.image_url
       FROM shop_inventory si
       INNER JOIN items i ON si.item_id = i.id
       WHERE si.shop_id = ?
       ORDER BY i.item_type, si.price`,
      [shopId]
    );

    // Calculate per-user stock for items with replenishment
    const items = await Promise.all((inventoryRows as any[]).map(async (item) => {
      // Skip calculation if no user or no replenishment period set
      if (!userId || !item.stock_replenish || item.stock === -1) {
        // Keep items visible even with 0 stock
        return item;
      }

      // Get user's purchase history for this specific item in this shop
      const [purchaseRows] = await pool.execute<any[]>(
        `SELECT COUNT(*) as purchase_count, MAX(timestamp) as last_purchase
         FROM shop_transactions
         WHERE user_id = ? AND shop_id = ? AND item_id = ?
         GROUP BY item_id`,
        [userId, shopId, item.item_id]
      );

      const purchaseData = (purchaseRows as any[])[0];
      
      if (!purchaseData) {
        // User hasn't purchased this item, show full stock
        return item;
      }

      const lastPurchase = new Date(purchaseData.last_purchase);
      const now = new Date();
      const hoursSinceLastPurchase = (now.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60);

      // If enough time has passed, reset stock
      if (hoursSinceLastPurchase >= item.stock_replenish) {
        return item; // Show full stock
      }

      // Otherwise, calculate remaining stock
      // Count purchases within the current replenish window
      const windowStart = new Date(now.getTime() - (item.stock_replenish * 60 * 60 * 1000));
      const [windowPurchases] = await pool.execute<any[]>(
        `SELECT COUNT(*) as count
         FROM shop_transactions
         WHERE user_id = ? AND shop_id = ? AND item_id = ? AND timestamp >= ?`,
        [userId, shopId, item.item_id, windowStart]
      );

      const purchasedInWindow = (windowPurchases as any[])[0]?.count || 0;
      const remainingStock = Math.max(0, item.stock - purchasedInWindow);

      // Keep item visible but show 0 stock if depleted
      return {
        ...item,
        stock: remainingStock
      };
    }));

    // Keep all items visible (don't filter out items with 0 stock)
    const availableItems = items;

    return NextResponse.json({
      items: availableItems
    });
  } catch (err: any) {
    return handleApiError(err, 'Failed to fetch shop inventory');
  }
}
