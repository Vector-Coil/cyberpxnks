import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, hardwareId, requiredQty } = body;

    if (!fid || !hardwareId || !requiredQty) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // Get hardware item and its upgrade material
    const [hardwareRows] = await pool.execute<any[]>(
      `SELECT ui.*, i.upgrades_with, i.name as item_name
       FROM user_inventory ui
       INNER JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = ? AND i.id = ?
       LIMIT 1`,
      [user.id, hardwareId]
    );

    if ((hardwareRows as any[]).length === 0) {
      return NextResponse.json({ error: 'Hardware not found in inventory' }, { status: 404 });
    }

    const hardware = (hardwareRows as any[])[0];
    
    if (!hardware.upgrades_with || hardware.upgrades_with === 0) {
      return NextResponse.json({ error: 'This hardware cannot be upgraded' }, { status: 400 });
    }

    // Check if user has enough upgrade materials
    const [materialRows] = await pool.execute<any[]>(
      `SELECT SUM(quantity) as total_quantity
       FROM user_inventory
       WHERE user_id = ? AND item_id = ?`,
      [user.id, hardware.upgrades_with]
    );

    const totalQuantity = (materialRows as any[])[0]?.total_quantity || 0;

    if (totalQuantity < requiredQty) {
      return NextResponse.json({ 
        error: `Insufficient materials. Need ${requiredQty}, have ${totalQuantity}` 
      }, { status: 400 });
    }

    // Perform upgrade: increment upgrade level and consume materials
    await pool.execute(
      `UPDATE user_inventory
       SET upgrade = upgrade + 1
       WHERE user_id = ? AND item_id = ?`,
      [user.id, hardwareId]
    );

    // Consume upgrade materials
    let remainingToConsume = requiredQty;
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT id, quantity FROM user_inventory
       WHERE user_id = ? AND item_id = ?
       ORDER BY acquired_at ASC`,
      [user.id, hardware.upgrades_with]
    );

    for (const row of inventoryRows as any[]) {
      if (remainingToConsume <= 0) break;

      if (row.quantity <= remainingToConsume) {
        // Delete this stack entirely
        await pool.execute(
          'DELETE FROM user_inventory WHERE id = ?',
          [row.id]
        );
        remainingToConsume -= row.quantity;
      } else {
        // Reduce quantity
        await pool.execute(
          'UPDATE user_inventory SET quantity = quantity - ? WHERE id = ?',
          [remainingToConsume, row.id]
        );
        remainingToConsume = 0;
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Hardware upgraded successfully',
      newUpgradeLevel: (hardware.upgrade || 0) + 1
    });

  } catch (err: any) {
    console.error('Hardware upgrade error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upgrade hardware' },
      { status: 500 }
    );
  }
}
