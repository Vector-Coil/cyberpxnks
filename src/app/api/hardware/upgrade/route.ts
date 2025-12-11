import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';

// Helper function to update user_stats with hardware modifiers after upgrade
async function updateHardwareStatsAfterUpgrade(pool: any, userId: number) {
  // Get equipped cyberdeck hardware modifiers with updated upgrade level
  const [hardwareRows] = await pool.execute(
    `SELECT 
      hm.cell_capacity,
      hm.heat_sink,
      hm.processor,
      hm.memory,
      hm.lifi,
      hm.encryption,
      ui.upgrade
    FROM user_loadout ul
    INNER JOIN hardware_modifiers hm ON ul.item_id = hm.item_id
    INNER JOIN user_inventory ui ON ul.item_id = ui.item_id AND ul.user_id = ui.user_id
    WHERE ul.user_id = ? AND ul.slot_type = 'hardware'
    LIMIT 1`,
    [userId]
  );

  let baseModifiers = {
    cell_capacity: 0,
    heat_sink: 0,
    processor: 0,
    memory: 0,
    lifi: 0,
    encryption: 0
  };

  if ((hardwareRows as any[]).length > 0) {
    const hw = (hardwareRows as any[])[0];
    const upgradeLevel = hw.upgrade ?? 0;
    baseModifiers = {
      cell_capacity: (hw.cell_capacity ?? 0) + upgradeLevel,
      heat_sink: (hw.heat_sink ?? 0) + upgradeLevel,
      processor: (hw.processor ?? 0) + upgradeLevel,
      memory: (hw.memory ?? 0) + upgradeLevel,
      lifi: (hw.lifi ?? 0) + upgradeLevel,
      encryption: (hw.encryption ?? 0) + upgradeLevel
    };
  }

  // Get slimsoft modifiers for encryption amplification
  const [slimsoftRows] = await pool.execute(
    `SELECT 
      se.target_stat,
      se.effect_value,
      se.is_percentage
    FROM user_loadout ul
    INNER JOIN slimsoft_effects se ON ul.item_id = se.item_id
    WHERE ul.user_id = ? AND ul.slot_type = 'slimsoft'`,
    [userId]
  );

  let encryptionMod = 0;
  for (const effect of slimsoftRows as any[]) {
    if (effect.target_stat === 'encryption') {
      const value = effect.effect_value ?? 0;
      if (effect.is_percentage) {
        encryptionMod += Math.floor(baseModifiers.encryption * (value / 100));
      } else {
        encryptionMod += value;
      }
    }
  }

  // Update user_stats with hardware base values and totals
  await pool.execute(
    `UPDATE user_stats 
     SET mod_cell_capacity = ?,
         total_cell_capacity = ?,
         mod_processor = ?,
         total_processor = ?,
         mod_heat_sink = ?,
         total_heat_sink = ?,
         mod_memory = ?,
         total_memory = ?,
         mod_lifi = ?,
         total_lifi = ?,
         mod_encryption = ?,
         total_encryption = ?
     WHERE user_id = ?`,
    [
      baseModifiers.cell_capacity,
      baseModifiers.cell_capacity,
      baseModifiers.processor,
      baseModifiers.processor,
      baseModifiers.heat_sink,
      baseModifiers.heat_sink,
      baseModifiers.memory,
      baseModifiers.memory,
      baseModifiers.lifi,
      baseModifiers.lifi,
      encryptionMod,
      baseModifiers.encryption + encryptionMod,
      userId
    ]
  );
}

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

    // Get stats BEFORE upgrade to track bandwidth changes
    const statsServiceBefore = new StatsService(pool, user.id);
    const statsBefore = await statsServiceBefore.getStats();
    const oldMaxBandwidth = statsBefore.max.bandwidth;
    const oldCurrentBandwidth = statsBefore.current.bandwidth;

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

    // Recalculate hardware stats after upgrade to update max bandwidth
    await updateHardwareStatsAfterUpgrade(pool, user.id);

    // Get stats AFTER upgrade to check if max bandwidth increased
    const statsServiceAfter = new StatsService(pool, user.id);
    const statsAfter = await statsServiceAfter.getStats();
    const newMaxBandwidth = statsAfter.max.bandwidth;

    // If max bandwidth increased, proportionately increase current bandwidth
    if (newMaxBandwidth > oldMaxBandwidth) {
      const bandwidthDelta = newMaxBandwidth - oldMaxBandwidth;
      const newCurrentBandwidth = Math.min(oldCurrentBandwidth + bandwidthDelta, newMaxBandwidth);
      
      await pool.execute(
        'UPDATE user_stats SET current_bandwidth = ? WHERE user_id = ?',
        [newCurrentBandwidth, user.id]
      );
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
