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
        if (item.item_type === 'hardware') {
          await connection.execute(
            'INSERT INTO user_hardware (user_id, hardware_id, acquired_date) VALUES (?, ?, UTC_TIMESTAMP())',
            [user.id, item.id]
          );
        } else if (item.item_type === 'slimsoft') {
          await connection.execute(
            'INSERT INTO user_slimsoft (user_id, slimsoft_id, acquired_date) VALUES (?, ?, UTC_TIMESTAMP())',
            [user.id, item.id]
          );
        } else if (item.item_type === 'consumable' || item.item_type === 'gear') {
          await connection.execute(
            `INSERT INTO user_inventory (user_id, item_type, item_id, quantity, acquired_date) 
             VALUES (?, ?, ?, 1, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [user.id, item.item_type, item.id]
          );
        }

        await logActivity(
          user.id,
          'shop',
          'admin_grant',
          0,
          shopId,
          `Admin granted ${item.name}`
        );

        await connection.commit();
        connection.release();

        return NextResponse.json({
          success: true,
          item: {
            name: item.name,
            type: item.item_type
          },
          cost: 0,
          currency: 'admin'
        });
      } catch (err) {
        await connection.rollback();
        connection.release();
        throw err;
      }
    }

    // Get shop item details
    const [itemRows] = await pool.execute<any[]>(
      `SELECT 
        id, shop_id, name, description, item_type, item_id, 
        price, currency, stock, required_level, required_street_cred
       FROM shop_inventory 
       WHERE id = ? AND shop_id = ? 
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

    // Check currency and balance
    if (item.currency === 'credits') {
      if (user.credits < item.price) {
        return NextResponse.json({ 
          error: `Insufficient credits. Need ${item.price}, have ${user.credits}` 
        }, { status: 403 });
      }
    } else if (item.currency === 'street_cred') {
      if (user.street_cred < item.price) {
        return NextResponse.json({ 
          error: `Insufficient Street Cred. Need ${item.price}, have ${user.street_cred}` 
        }, { status: 403 });
      }
    }

    // Check stock
    if (item.stock === 0) {
      return NextResponse.json({ error: 'Item out of stock' }, { status: 403 });
    }

    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deduct currency
      if (item.currency === 'credits') {
        await connection.execute(
          'UPDATE users SET credits = credits - ? WHERE id = ?',
          [item.price, user.id]
        );
      } else {
        await connection.execute(
          'UPDATE users SET street_cred = street_cred - ? WHERE id = ?',
          [item.price, user.id]
        );
      }

      // Handle item based on type
      if (item.item_type === 'hardware') {
        // Add to user_hardware
        await connection.execute(
          'INSERT INTO user_hardware (user_id, hardware_id, acquired_date) VALUES (?, ?, UTC_TIMESTAMP())',
          [user.id, item.item_id]
        );
      } else if (item.item_type === 'slimsoft') {
        // Add to user_slimsoft
        await connection.execute(
          'INSERT INTO user_slimsoft (user_id, slimsoft_id, acquired_date) VALUES (?, ?, UTC_TIMESTAMP())',
          [user.id, item.item_id]
        );
      } else if (item.item_type === 'consumable' || item.item_type === 'gear') {
        // Add to user_inventory (generic inventory table)
        await connection.execute(
          `INSERT INTO user_inventory (user_id, item_type, item_id, quantity, acquired_date) 
           VALUES (?, ?, ?, 1, UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
          [user.id, item.item_type, item.item_id]
        );
      }

      // Update stock if not unlimited
      if (item.stock > 0) {
        await connection.execute(
          'UPDATE shop_inventory SET stock = stock - 1 WHERE id = ?',
          [itemId]
        );
      }

      // Record transaction
      await connection.execute(
        `INSERT INTO shop_transactions 
         (user_id, shop_id, item_id, item_name, price, currency, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [user.id, shopId, itemId, item.name, item.price, item.currency]
      );

      // Log activity
      await logActivity(
        user.id,
        'shop',
        'purchase',
        item.price,
        shopId,
        `Purchased ${item.name} for ${item.price} ${item.currency}`
      );

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        item: {
          name: item.name,
          type: item.item_type
        },
        cost: item.price,
        currency: item.currency
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err: any) {
    return handleApiError(err, 'Failed to complete purchase');
  }
}
