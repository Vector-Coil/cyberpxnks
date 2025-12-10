import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../lib/db';
import { StatsService } from '../../../../lib/statsService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const body = await request.json();
    const { poiId, zoneId } = body;

    if (!poiId || !zoneId) {
      return NextResponse.json({ error: 'Missing poiId or zoneId' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID and location
    const [userRows] = await pool.execute<any[]>(
      'SELECT id, location FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine if this is a physical or remote breach
    const isPhysicalBreach = user.location === zoneId;
    const chargeCost = isPhysicalBreach ? 15 : 10;
    const staminaCost = isPhysicalBreach ? 15 : 0;

    // Verify user has unlocked this POI
    const [poiAccessRows] = await pool.execute<any[]>(
      'SELECT poi_id FROM user_poi_history WHERE user_id = ? AND poi_id = ? LIMIT 1',
      [user.id, poiId]
    );

    if (poiAccessRows.length === 0) {
      return NextResponse.json({ error: 'POI not unlocked' }, { status: 403 });
    }

    // Get POI details
    const [poiRows] = await pool.execute<any[]>(
      'SELECT id, name, zone_id FROM points_of_interest WHERE id = ? LIMIT 1',
      [poiId]
    );
    const poi = (poiRows as any[])[0];

    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // Get user stats using StatsService
    const statsService = new StatsService(pool, user.id);
    const fullStats = await statsService.getStats();
    const stats = {
      current_charge: fullStats.current.charge,
      current_stamina: fullStats.current.stamina,
      current_bandwidth: fullStats.current.bandwidth,
      max_bandwidth: fullStats.max.bandwidth
    };

    // Count currently active jobs
    const [activeJobsRows] = await pool.execute<any[]>(
      `SELECT COUNT(*) as active_count FROM user_zone_history
       WHERE user_id = ? 
       AND action_type IN ('Breached', 'Scouted', 'Exploring')
       AND (result_status IS NULL OR result_status = '')
       LIMIT 1`,
      [user.id]
    );
    const activeCount = (activeJobsRows as any[])[0]?.active_count || 0;

    if (activeCount >= stats.max_bandwidth) {
      return NextResponse.json({ error: `Maximum concurrent actions reached (${stats.max_bandwidth})` }, { status: 400 });
    }

    if (stats.current_bandwidth < 1) {
      return NextResponse.json({ error: 'Insufficient bandwidth (1 required)' }, { status: 400 });
    }

    if (stats.current_charge < chargeCost) {
      return NextResponse.json({ error: `Insufficient charge (${chargeCost} required)` }, { status: 400 });
    }

    if (isPhysicalBreach && stats.current_stamina < staminaCost) {
      return NextResponse.json({ error: `Insufficient stamina (${staminaCost} required)` }, { status: 400 });
    }

    // Check if user already has an active breach on THIS specific POI
    const [activeBreachRows] = await pool.execute<any[]>(
      `SELECT id FROM user_zone_history 
       WHERE user_id = ? AND poi_id = ? AND action_type IN ('Breached', 'RemoteBreach')
       AND (result_status IS NULL OR result_status = '') 
       AND end_time > UTC_TIMESTAMP()
       LIMIT 1`,
      [user.id, poiId]
    );

    if (activeBreachRows.length > 0) {
      return NextResponse.json({ error: 'Already breaching this terminal' }, { status: 400 });
    }

    // Deduct resources based on breach type
    if (isPhysicalBreach) {
      await pool.execute(
        `UPDATE user_stats 
         SET current_charge = GREATEST(current_charge - ?, 0),
             current_stamina = GREATEST(current_stamina - ?, 0),
             current_bandwidth = GREATEST(current_bandwidth - 1, 0)
         WHERE user_id = ?`,
        [chargeCost, staminaCost, user.id]
      );
    } else {
      await pool.execute(
        `UPDATE user_stats 
         SET current_charge = GREATEST(current_charge - ?, 0),
             current_bandwidth = GREATEST(current_bandwidth - 1, 0)
         WHERE user_id = ?`,
        [chargeCost, user.id]
      );
    }

    // Create breach action (1 minute duration for testing)
    const endTime = new Date(Date.now() + 60 * 1000); // 1 minute from now
    const breachType = isPhysicalBreach ? 'Breached' : 'RemoteBreach';
    console.log('Creating breach:', { userId: user.id, zoneId, poiId, endTime, breachType, isPhysicalBreach });
    const [insertResult] = await pool.execute<any>(
      `INSERT INTO user_zone_history (user_id, zone_id, action_type, timestamp, end_time, poi_id)
       VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
      [user.id, zoneId, breachType, endTime, poiId]
    );

    const historyId = (insertResult as any).insertId;
    console.log('Breach created with history ID:', historyId);

    // Log activity
    await logActivity(
      user.id,
      'action',
      'breach_started',
      60, // seconds (testing)
      poiId,
      `Started breaching ${poi.name}`
    );

    // Get updated stats using StatsService
    const updatedStatsService = new StatsService(pool, user.id);
    const updatedFullStats = await updatedStatsService.getStats();
    const updatedStats = {
      current_consciousness: updatedFullStats.current.consciousness,
      max_consciousness: updatedFullStats.max.consciousness,
      current_stamina: updatedFullStats.current.stamina,
      max_stamina: updatedFullStats.max.stamina,
      current_bandwidth: updatedFullStats.current.bandwidth,
      max_bandwidth: updatedFullStats.max.bandwidth,
      current_charge: updatedFullStats.current.charge,
      max_charge: updatedFullStats.max.charge,
      current_thermal: updatedFullStats.current.thermal,
      max_thermal: updatedFullStats.max.thermal,
      current_neural: updatedFullStats.current.neural,
      max_neural: updatedFullStats.max.neural
    };

    return NextResponse.json({
      success: true,
      breachAction: {
        id: historyId,
        action_type: 'Breached',
        end_time: endTime.toISOString()
      },
      updatedStats
    });
  } catch (err: any) {
    console.error('Breach API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to start breach' },
      { status: 500 }
    );
  }
}
