import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = parseInt(searchParams.get('fid') || '300187', 10);
    const itemIds = searchParams.get('itemIds'); // Comma-separated list of item IDs

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

    let query = `
      SELECT 
        se.item_id,
        se.effect_name,
        se.effect_type,
        se.available_at,
        se.target_stat,
        se.effect_value,
        se.is_percentage,
        se.description,
        i.name as slimsoft_name,
        i.image_url as slimsoft_image_url
      FROM slimsoft_effects se
      INNER JOIN items i ON se.item_id = i.id
    `;

    let params: any[] = [];

    // If specific item IDs are requested, filter by them
    if (itemIds) {
      const ids = itemIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        query += ` WHERE se.item_id IN (${ids.map(() => '?').join(',')})`;
        params = ids;
      }
    }

    query += ` ORDER BY se.item_id, se.effect_name`;

    const [effectRows] = await pool.execute<any[]>(query, params);

    return NextResponse.json({
      effects: effectRows
    });
  } catch (error) {
    console.error('Failed to fetch slimsoft effects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch slimsoft effects' },
      { status: 500 }
    );
  }
}
