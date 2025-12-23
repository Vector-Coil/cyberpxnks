import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { requireParams, handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    requireParams(body, ['shopId', 'itemId']);
    const { shopId, itemId } = body;

    logger.info('[Shop Purchase] Request:', { fid, shopId, itemId });

    const pool = await getDbPool();

    // Get user ID and current resources
    const [userRows] = await pool.execute<any[]>(
      'SELECT id, credits, street_cred, level FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Admin shop (ID 4) - special handling
    if (shopId === 4) {
      // Only allow admin FID
      if (fid !== 300187) {
        return NextResponse.json({ error: 'Admin access only' }, { status: 403 });
      }

      // Get item from items table
      const [itemRows] = await pool.execute<any[]>(
        'SELECT id, name, description, item_type, image_url FROM items WHERE id = ? LIMIT 1',
        [itemId]
      );
      const item = (itemRows as any[])[0];

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      // Add to inventory without any checks
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // All items go into user_inventory table
        await connection.execute(
          `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at) 
           VALUES (?, ?, 1, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
          [user.id, item.id]
        );

        try {
          await logActivity(
            user.id,
            'shop',
            'admin_grant',
            0,
            shopId,
            `Admin granted ${item.name}`
          );
        } catch (logErr: any) {
          logger.warn('[Shop Purchase] Admin logActivity failed:', logErr.message);
          // Continue - activity log is optional
        }

        await connection.commit();
        connection.release();

        return NextResponse.json({
          success: true,
          item: {
            name: item.name,
            type: item.item_type
          },
          cost: 0
        });
      } catch (err: any) {
        await connection.rollback();
        connection.release();
        logger.error('[Shop Purchase] Admin transaction failed:', err);
        throw err;
      }
    }

    // Get shop item details
    const [itemRows] = await pool.execute<any[]>(
      `SELECT 
        si.id, si.shop_id, si.item_id, si.price, si.stock, si.stock_replenish,
        si.required_level, si.required_street_cred,
        i.name, i.description, i.item_type, i.image_url
       FROM shop_inventory si
       INNER JOIN items i ON si.item_id = i.id
       WHERE si.id = ? AND si.shop_id = ? 
       LIMIT 1`,
      [itemId, shopId]
    );
    const item = (itemRows as any[])[0];

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Verify requirements
    if (item.required_level && user.level < item.required_level) {
      return NextResponse.json({ 
        error: `Level ${item.required_level} required` 
      }, { status: 403 });
    }

    if (item.required_street_cred && user.street_cred < item.required_street_cred) {
      return NextResponse.json({ 
        error: `${item.required_street_cred} Street Cred required` 
      }, { status: 403 });
    }

    // Check credits balance
    if (user.credits < item.price) {
      return NextResponse.json({ 
        error: `Insufficient credits. Need ${item.price}, have ${user.credits}` 
      }, { status: 403 });
    }

    // Check stock
    if (item.stock === 0) {
      return NextResponse.json({ error: 'Item out of stock' }, { status: 403 });
    }

    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deduct credits
      await connection.execute(
        'UPDATE users SET credits = credits - ? WHERE id = ?',
        [item.price, user.id]
      );

      // Handle item - all items go into user_inventory table
      await connection.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at) 
         VALUES (?, ?, 1, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [user.id, item.item_id]
      );

      // Update stock if not unlimited AND no replenishment system
      // Items with stock_replenish use per-user purchase history instead
      if (item.stock > 0 && !item.stock_replenish) {
        await connection.execute(
          'UPDATE shop_inventory SET stock = stock - 1 WHERE id = ?',
          [itemId]
        );
      }

      // For items WITH replenishment, check if user has exceeded their window limit
      if (item.stock_replenish && item.stock > 0) {
        const windowStart = new Date(Date.now() - (item.stock_replenish * 60 * 60 * 1000));
        const [windowPurchases] = await connection.execute<any[]>(
          `SELECT COUNT(*) as count
           FROM shop_transactions
           WHERE user_id = ? AND shop_id = ? AND item_id = ? AND timestamp >= ?`,
          [user.id, shopId, item.item_id, windowStart]
        );
        
        const purchasedInWindow = (windowPurchases as any[])[0]?.count || 0;
        if (purchasedInWindow >= item.stock) {
          await connection.rollback();
          connection.release();
          return NextResponse.json({ 
            error: 'Item temporarily out of stock. Check back later.' 
          }, { status: 403 });
        }
      }

      // Record transaction (if table exists)
      try {
        await connection.execute(
          `INSERT INTO shop_transactions 
           (user_id, shop_id, item_id, item_name, price, timestamp) 
           VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
          [user.id, shopId, item.item_id, item.name, item.price]
        );
      } catch (transErr: any) {
        logger.warn('[Shop Purchase] shop_transactions insert failed:', transErr.message);
        // Continue - transaction history is optional
      }

      // Log activity
      try {
        await logActivity(
          user.id,
          'shop',
          'purchase',
          item.price,
          shopId,
          `Purchased ${item.name} for ${item.price} credits`
        );
      } catch (logErr: any) {
        logger.warn('[Shop Purchase] logActivity failed:', logErr.message);
        // Continue - activity log is optional
      }

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        item: {
          name: item.name,
          type: item.item_type
        },
        cost: item.price
      });
    } catch (err: any) {
      await connection.rollback();
      connection.release();
      logger.error('[Shop Purchase] Transaction failed:', err);
      throw err;
    }
  } catch (err: any) {
    logger.error('[Shop Purchase] Error:', err);
    return handleApiError(err, 'Failed to complete purchase');
  }
}
