import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Fetch cyberdecks with equipped status (slot_type = 'hardware') and hardware modifiers
    // Also get upgrade material info and count
    const [cyberdeckRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.tier,
        i.image_url,
        i.model,
        i.upgrades_with,
        ui.quantity,
        ui.upgrade,
        ui.acquired_at,
        CASE WHEN ul.item_id IS NOT NULL THEN 1 ELSE 0 END as is_equipped,
        ul.slot_name,
        hm.cell_capacity,
        hm.heat_sink,
        hm.processor,
        hm.memory,
        hm.lifi,
        hm.encryption,
        upgrade_items.name as upgrade_material_name,
        upgrade_items.image_url as upgrade_material_image,
        COALESCE((
          SELECT COUNT(*) 
          FROM user_inventory ui2 
          WHERE ui2.user_id = ui.user_id 
          AND ui2.item_id = i.upgrades_with
        ), 0) as upgrade_material_count
      FROM user_inventory ui
      INNER JOIN items i ON ui.item_id = i.id
      LEFT JOIN user_loadout ul ON ul.user_id = ui.user_id AND ul.item_id = i.id AND ul.slot_type = 'hardware'
      LEFT JOIN hardware_modifiers hm ON i.id = hm.item_id
      LEFT JOIN items upgrade_items ON upgrade_items.id = i.upgrades_with
      WHERE ui.user_id = ? AND i.item_type = 'cyberdeck'
      ORDER BY is_equipped DESC, i.tier DESC, i.name ASC`,
      [userId]
    );

    // Fetch peripherals
    const [peripheralRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.tier,
        i.image_url,
        i.model,
        SUM(ui.quantity) as quantity,
        MIN(ui.acquired_at) as acquired_at
      FROM user_inventory ui
      INNER JOIN items i ON ui.item_id = i.id
      WHERE ui.user_id = ? AND i.item_type = 'peripheral'
      GROUP BY i.id, i.name, i.item_type, i.description, i.tier, i.image_url, i.model
      ORDER BY i.name ASC`,
      [userId]
    );

    // Fetch slimsoft with equipped status (up to 3 slots)
    const [slimsoftRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.tier,
        i.image_url,
        i.model,
        SUM(ui.quantity) as quantity,
        MIN(ui.acquired_at) as acquired_at,
        MAX(CASE WHEN ul.item_id IS NOT NULL THEN 1 ELSE 0 END) as is_equipped,
        MAX(ul.slot_name) as slot_name
      FROM user_inventory ui
      INNER JOIN items i ON ui.item_id = i.id
      LEFT JOIN user_loadout ul ON ul.user_id = ui.user_id AND ul.item_id = i.id AND ul.slot_type = 'slimsoft'
      WHERE ui.user_id = ? AND i.item_type = 'slimsoft'
      GROUP BY i.id, i.name, i.item_type, i.description, i.tier, i.image_url, i.model
      ORDER BY is_equipped DESC, i.name ASC`,
      [userId]
    );

    // Get equipped counts
    const [hardwareCount] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM user_loadout 
       WHERE user_id = ? AND slot_type = 'hardware'`,
      [userId]
    );
    
    const [slimsoftCount] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM user_loadout 
       WHERE user_id = ? AND slot_type = 'slimsoft'`,
      [userId]
    );

    // Fetch arsenal items with equipped status and modifiers
    const [arsenalRows] = await pool.execute<any[]>(
      `SELECT 
        i.id,
        i.name,
        i.item_type,
        i.description,
        i.tier,
        i.image_url,
        i.model,
        SUM(ui.quantity) as quantity,
        MIN(ui.acquired_at) as acquired_at,
        MAX(ui.upgrade) as upgrade,
        MAX(CASE WHEN ul.item_id IS NOT NULL THEN 1 ELSE 0 END) as is_equipped,
        am.tactical,
        am.smart_tech,
        am.offense,
        am.defense,
        am.evasion,
        am.stealth,
        am.consciousness,
        am.stamina,
        am.charge,
        am.neural,
        am.thermal,
        am.discovery_zone,
        am.discovery_poi,
        am.discovery_item
      FROM user_inventory ui
      INNER JOIN items i ON ui.item_id = i.id
      LEFT JOIN user_loadout ul ON ul.user_id = ui.user_id AND ul.item_id = i.id AND ul.slot_type = 'arsenal'
      LEFT JOIN arsenal_modifiers am ON i.id = am.item_id
      WHERE ui.user_id = ? AND i.item_type IN ('weapon', 'accessory', 'relic')
      GROUP BY i.id, i.name, i.item_type, i.description, i.tier, i.image_url, i.model, 
               am.tactical, am.smart_tech, am.offense, am.defense, am.evasion, am.stealth,
               am.consciousness, am.stamina, am.charge, am.neural, am.thermal,
               am.discovery_zone, am.discovery_poi, am.discovery_item
      ORDER BY is_equipped DESC, i.name ASC`,
      [userId]
    );

    // Get equipped arsenal count
    const [arsenalCount] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM user_loadout 
       WHERE user_id = ? AND slot_type = 'arsenal'`,
      [userId]
    );

    // Get equipped cyberdeck tier for compatibility checks
    const equippedDeck = (cyberdeckRows as any[]).find((d: any) => d.is_equipped === 1);
    const equippedDeckTier = equippedDeck?.tier || 0;

    logger.info('Retrieved hardware inventory', { 
      fid, 
      cyberdecks: cyberdeckRows.length,
      peripherals: peripheralRows.length,
      slimsoft: slimsoftRows.length,
      arsenal: arsenalRows.length
    });

    return NextResponse.json({
      cyberdecks: cyberdeckRows,
      peripherals: peripheralRows,
      slimsoft: slimsoftRows,
      arsenal: arsenalRows,
      equippedCounts: {
        cyberdeck: (hardwareCount as any[])[0].count,
        slimsoft: (slimsoftCount as any[])[0].count,
        arsenal: (arsenalCount as any[])[0].count
      },
      equippedDeckTier
    });
  } catch (err: any) {
    return handleApiError(err, '/api/hardware');
  }
}
