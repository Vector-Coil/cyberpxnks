import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '~/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fid, zoneId } = body;

    if (!fid || !zoneId) {
      return NextResponse.json({ error: 'Missing fid or zoneId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID and current stats
    const [userRows]: any = await pool.execute(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userRows[0].id;

    // Get current stamina
    const [statsRows]: any = await pool.execute(
      'SELECT current_stamina FROM user_stats WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (statsRows.length === 0) {
      return NextResponse.json({ error: 'User stats not found' }, { status: 404 });
    }

    const currentStamina = statsRows[0].current_stamina;
    const travelCost = 25;

    // Check if user has enough stamina
    if (currentStamina < travelCost) {
      return NextResponse.json({ error: 'Not enough stamina' }, { status: 400 });
    }

    // Get zone name for history
    const [zoneRows]: any = await pool.execute(
      'SELECT name FROM zones WHERE id = ? LIMIT 1',
      [zoneId]
    );
    const zoneName = zoneRows[0]?.name || 'Unknown Zone';

    // Update user location and deduct stamina
    await pool.execute(
      'UPDATE users SET location = ? WHERE id = ?',
      [zoneId, userId]
    );

    await pool.execute(
      'UPDATE user_stats SET current_stamina = current_stamina - ? WHERE user_id = ?',
      [travelCost, userId]
    );

    // Record travel in zone history
    await pool.execute(
      `INSERT INTO user_zone_history (user_id, zone_id, action_type, timestamp, result_status)
       VALUES (?, ?, 'Traveled', UTC_TIMESTAMP(), 'completed')`,
      [userId, zoneId]
    );

    // Log to activity ledger
    await logActivity(
      userId,
      'action',
      'travel',
      travelCost,
      zoneId,
      `Traveled to ${zoneName}`
    );

    // Get updated stats
    const [updatedStatsRows]: any = await pool.execute(
      `SELECT 
        current_consciousness, max_consciousness,
        current_stamina, max_stamina,
        current_charge, max_charge,
        current_bandwidth, max_bandwidth,
        current_thermal, max_thermal,
        current_neural, max_neural
       FROM user_stats 
       WHERE user_id = ? 
       LIMIT 1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      location: zoneId,
      updatedStats: updatedStatsRows[0]
    });
  } catch (error: any) {
    console.error('Error during travel:', error);
    return NextResponse.json(
      { error: 'Failed to travel', details: error.message },
      { status: 500 }
    );
  }
}
