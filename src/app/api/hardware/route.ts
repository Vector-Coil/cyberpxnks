import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);

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
      [user.id]
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
      [user.id]
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
      [user.id]
    );

    // Get equipped counts
    const [hardwareCount] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM user_loadout 
       WHERE user_id = ? AND slot_type = 'hardware'`,
      [user.id]
    );
    
    const [slimsoftCount] = await pool.execute<any[]>(
      `SELECT COUNT(*) as count FROM user_loadout 
       WHERE user_id = ? AND slot_type = 'slimsoft'`,
      [user.id]
    );

    // Get equipped cyberdeck tier for compatibility checks
    const equippedDeck = (cyberdeckRows as any[]).find((d: any) => d.is_equipped === 1);
    const equippedDeckTier = equippedDeck?.tier || 0;

    return NextResponse.json({
      cyberdecks: cyberdeckRows,
      peripherals: peripheralRows,
      slimsoft: slimsoftRows,
      equippedCounts: {
        cyberdeck: (hardwareCount as any[])[0].count,
        slimsoft: (slimsoftCount as any[])[0].count
      },
      equippedDeckTier
    });
  } catch (err: any) {
    console.error('Hardware API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch hardware' },
      { status: 500 }
    );
  }
}
