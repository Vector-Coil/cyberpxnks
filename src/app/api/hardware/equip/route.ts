import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';
import { handleApiError } from '../../../../lib/api/errors';
import { getUserIdByFid } from '../../../../lib/api/userUtils';
import { logger } from '../../../../lib/logger';

// Helper function to update user_stats with hardware modifiers from equipped cyberdeck
async function updateHardwareStats(pool: any, userId: number) {
  // Get equipped cyberdeck hardware modifiers
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
  // mod_ columns are for slimsoft/other future modifiers (currently only encryption from slimsoft)
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

// Helper function to update user_stats with slimsoft modifiers
async function updateSlimsoftStats(pool: any, userId: number) {
  // Get all equipped slimsoft effects
  const [effectRows] = await pool.execute(
    `SELECT 
      se.target_stat,
      se.effect_value,
      se.is_percentage
    FROM user_loadout ul
    INNER JOIN slimsoft_effects se ON ul.item_id = se.item_id
    WHERE ul.user_id = ? AND ul.slot_type = 'slimsoft'`,
    [userId]
  );

  // Calculate total modifiers
  let decryptionMod = 0;
  let antivirusMod = 0;

  for (const effect of effectRows as any[]) {
    const value = effect.effect_value ?? 0;
    
    if (effect.target_stat === 'decryption') {
      decryptionMod += value;
    } else if (effect.target_stat === 'antivirus') {
      antivirusMod += value;
    }
  }

  // Get current user_stats
  const [statsRows] = await pool.execute(
    `SELECT base_crypt FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  if ((statsRows as any[]).length === 0) {
    // No stats row exists yet, skip update
    return;
  }

  const baseCrypt = (statsRows as any[])[0].base_crypt ?? 0;
  const totalCrypt = baseCrypt + decryptionMod;

  // Update mod_crypt, total_crypt, and antivirus
  await pool.execute(
    `UPDATE user_stats 
     SET mod_crypt = ?, total_crypt = ?, antivirus = ?
     WHERE user_id = ?`,
    [decryptionMod, totalCrypt, antivirusMod, userId]
  );

  // Recalculate hardware stats (especially encryption which can be amplified by slimsoft)
  await updateHardwareStats(pool, userId);
}

export async function POST(request: NextRequest) {
  try {
    const { fid, itemId, slotType, action } = await request.json();
    
    if (!itemId || !slotType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['cyberdeck', 'slimsoft'].includes(slotType)) {
      return NextResponse.json({ error: 'Invalid slot type' }, { status: 400 });
    }

    const pool = await getDbPool();

    const userId = await getUserIdByFid(pool, fid || 300187);

    // Verify user owns the item
    const [inventoryRows] = await pool.execute<any[]>(
      `SELECT ui.id, i.name 
       FROM user_inventory ui
       INNER JOIN items i ON ui.item_id = i.id
       WHERE ui.user_id = ? AND ui.item_id = ?
       LIMIT 1`,
      [userId, itemId]
    );
    const inventoryItem = (inventoryRows as any[])[0];
    if (!inventoryItem) {
      return NextResponse.json({ error: 'Item not found in inventory' }, { status: 404 });
    }

    if (action === 'unequip') {
      if (slotType === 'cyberdeck') {
        // For cyberdecks, delete the hardware slot row
        await pool.execute(
          'DELETE FROM user_loadout WHERE user_id = ? AND slot_type = ?',
          [userId, 'hardware']
        );
        // Update user_stats to clear hardware modifiers
        await updateHardwareStats(pool, userId);
        // Cap current stats at new max values (max values decreased after unequip)
        const statsService = new StatsService(pool, userId);
        await statsService.capAtMax();
        // Log to activity ledger
        await logActivity(
          userId,
          'hardware',
          'unequip_cyberdeck',
          null,
          itemId,
          `Unequipped ${inventoryItem.name}`
        );
      } else {
        // For slimsoft, delete the specific item row
        await pool.execute(
          'DELETE FROM user_loadout WHERE user_id = ? AND item_id = ? AND slot_type = ?',
          [userId, itemId, slotType]
        );
        // Update user_stats to remove slimsoft modifiers
        await updateSlimsoftStats(pool, userId);
        // Cap current stats at new max values (in case slimsoft affected max calculations)
        const statsService = new StatsService(pool, userId);
        await statsService.capAtMax();
        // Log to activity ledger
        await logActivity(
          userId,
          'hardware',
          'unequip_slimsoft',
          null,
          itemId,
          `Unequipped ${inventoryItem.name}`
        );
      }

      return NextResponse.json({ 
        success: true,
        message: `${inventoryItem.name} unequipped`
      });
    }

    // Handle cyberdeck equipping
    if (slotType === 'cyberdeck') {
      // Get the tier of the new cyberdeck
      const [deckRows] = await pool.execute<any[]>(
        `SELECT tier FROM items WHERE id = ? LIMIT 1`,
        [itemId]
      );
      const newDeckTier = (deckRows as any[])[0]?.tier || 1;

      // Check if hardware slot exists
      const [hardwareSlot] = await pool.execute<any[]>(
        `SELECT id FROM user_loadout 
         WHERE user_id = ? AND slot_type = ?
         LIMIT 1`,
        [userId, 'hardware']
      );

      if ((hardwareSlot as any[]).length > 0) {
        // Update existing hardware slot with new cyberdeck
        await pool.execute(
          `UPDATE user_loadout 
           SET item_id = ?, slot_name = ?
           WHERE user_id = ? AND slot_type = ?`,
          [itemId, 'cyberdeck_main', userId, 'hardware']
        );
      } else {
        // Create new hardware slot
        await pool.execute(
          `INSERT INTO user_loadout (user_id, slot_name, item_id, slot_type)
           VALUES (?, ?, ?, ?)`,
          [userId, 'cyberdeck_main', itemId, 'hardware']
        );
      }

      // Auto-unequip incompatible slimsoft (tier higher than new deck tier)
      await pool.execute(
        `DELETE ul FROM user_loadout ul
         INNER JOIN items i ON ul.item_id = i.id
         WHERE ul.user_id = ? AND ul.slot_type = 'slimsoft' AND i.tier > ?`,
        [userId, newDeckTier]
      );

      // Update user_stats with hardware modifiers
      await updateHardwareStats(pool, userId);
      
      // Update slimsoft stats (in case any were auto-unequipped)
      await updateSlimsoftStats(pool, userId);

      // Cap current stats at new max values (max values may have changed)
      const statsService = new StatsService(pool, userId);
      await statsService.capAtMax();

      // Log to activity ledger
      await logActivity(
        userId,
        'hardware',
        'equip_cyberdeck',
        null,
        itemId,
        `Equipped ${inventoryItem.name}`
      );

      return NextResponse.json({ 
        success: true,
        message: `${inventoryItem.name} equipped`,
        slotName: 'cyberdeck_main'
      });
    }

    // Handle slimsoft equipping
    if (slotType === 'slimsoft') {
      // Get equipped cyberdeck tier
      const [deckRows] = await pool.execute<any[]>(
        `SELECT i.tier FROM user_loadout ul
         INNER JOIN items i ON ul.item_id = i.id
         WHERE ul.user_id = ? AND ul.slot_type = 'hardware'
         LIMIT 1`,
        [userId]
      );
      const deckTier = (deckRows as any[])[0]?.tier || 0;

      if (deckTier === 0) {
        return NextResponse.json({ 
          error: 'Must have a cyberdeck equipped to use slimsoft' 
        }, { status: 400 });
      }

      // Get slimsoft tier
      const [softRows] = await pool.execute<any[]>(
        `SELECT tier FROM items WHERE id = ? LIMIT 1`,
        [itemId]
      );
      const softTier = (softRows as any[])[0]?.tier || 1;

      // Check tier compatibility
      if (softTier > deckTier) {
        return NextResponse.json({ 
          error: `This slimsoft requires a tier ${softTier} or higher cyberdeck` 
        }, { status: 400 });
      }

      // Get currently used slimsoft slots
      const [equippedRows] = await pool.execute<any[]>(
        `SELECT slot_name FROM user_loadout 
         WHERE user_id = ? AND slot_type = ?`,
        [userId, slotType]
      );
      const usedSlots = (equippedRows as any[]).map(row => row.slot_name);

      // Check if we're at max slots (3)
      if (usedSlots.length >= 3) {
        return NextResponse.json({ 
          error: `Maximum 3 slimsoft slots already equipped` 
        }, { status: 400 });
      }

      // Check if this specific item is already equipped
      const [alreadyEquippedRows] = await pool.execute<any[]>(
        `SELECT id FROM user_loadout 
         WHERE user_id = ? AND item_id = ? AND slot_type = ?
         LIMIT 1`,
        [userId, itemId, slotType]
      );
      
      if ((alreadyEquippedRows as any[]).length > 0) {
        return NextResponse.json({ 
          error: 'Item already equipped' 
        }, { status: 400 });
      }

      // Find the first available slot (slimsoft_1, slimsoft_2, or slimsoft_3)
      let slotName = '';
      for (let i = 1; i <= 3; i++) {
        const testSlot = `slimsoft_${i}`;
        if (!usedSlots.includes(testSlot)) {
          slotName = testSlot;
          break;
        }
      }

      // Add to loadout
      await pool.execute(
        `INSERT INTO user_loadout (user_id, slot_name, item_id, slot_type)
         VALUES (?, ?, ?, ?)`,
        [userId, slotName, itemId, slotType]
      );

      // Update user_stats with slimsoft modifiers
      await updateSlimsoftStats(pool, userId);

      // Cap current stats at new max values (in case slimsoft affected max calculations)
      const statsService = new StatsService(pool, userId);
      await statsService.capAtMax();

      // Log to activity ledger
      await logActivity(
        userId,
        'hardware',
        'equip_slimsoft',
        null,
        itemId,
        `Equipped ${inventoryItem.name}`
      );

      return NextResponse.json({ 
        success: true,
        message: `${inventoryItem.name} equipped`,
        slotName
      });
    }

    return NextResponse.json({ 
      error: 'Invalid operation'
    }, { status: 400 });
  } catch (err: any) {
    return handleApiError(err, 'Failed to equip item');
  }
}
