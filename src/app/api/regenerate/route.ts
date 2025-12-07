import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initialize StatsService
    const statsService = new StatsService(pool, user.id);

    // Check for active breaches (count them for thermal/neural calculation)
    const [activeBreachRows] = await pool.execute<any[]>(
      `SELECT id, timestamp FROM user_zone_history 
       WHERE user_id = ? AND action_type = 'Breached' 
       AND (result_status IS NULL OR result_status = '') 
       AND end_time > UTC_TIMESTAMP()`,
      [user.id]
    );
    const activeBreachCount = activeBreachRows.length;

    // Get current stats and last regeneration timestamp
    // Also get current UTC time from database to ensure consistency
    const [statsRows] = await pool.execute<any[]>(
      'SELECT *, last_regeneration, UTC_TIMESTAMP() as db_now FROM user_stats WHERE user_id = ? LIMIT 1',
      [user.id]
    );
    const stats = (statsRows as any[])[0];

    if (!stats) {
      return NextResponse.json({ error: 'Stats not found' }, { status: 404 });
    }

    // If last_regeneration is NULL, initialize it to now
    if (!stats.last_regeneration) {
      console.log('Initializing last_regeneration to current UTC time');
      await pool.execute(
        'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
        [user.id]
      );
      return NextResponse.json({ success: true, stats, intervalsElapsed: 0 });
    }

    // Calculate time elapsed since last regeneration using database UTC time
    const dbNow = new Date(stats.db_now);
    const lastRegen = new Date(stats.last_regeneration);
    const msElapsed = dbNow.getTime() - lastRegen.getTime();
    const intervalsElapsed = Math.floor(msElapsed / (15 * 60 * 1000)); // 15 minutes in ms

    console.log('Regeneration debug:', {
      dbNow: dbNow.toISOString(),
      lastRegen: lastRegen.toISOString(),
      msElapsed,
      intervalsElapsed,
      activeBreachCount,
      currentValues: {
        consciousness: stats.current_consciousness,
        stamina: stats.current_stamina,
        charge: stats.current_charge,
        bandwidth: stats.current_bandwidth,
        thermal: stats.current_thermal,
        neural: stats.current_neural
      }
    });

    // If last_regeneration is in the future (clock skew), reset it to now
    if (intervalsElapsed < 0) {
      console.log('WARNING: last_regeneration is in the future, resetting to now');
      await pool.execute(
        'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
        [user.id]
      );
      return NextResponse.json({ success: true, stats, intervalsElapsed: 0 });
    }

    // Cap intervals at 96 (24 hours worth at 15-min intervals) to prevent overflow from very old timestamps
    const cappedIntervals = Math.min(intervalsElapsed, 96);

    if (cappedIntervals === 0) {
      // No regeneration needed yet
      return NextResponse.json({ success: true, stats, intervalsElapsed: 0 });
    }

    // Calculate regeneration amounts
    const regenAmount = cappedIntervals * 5;
    
    // Regenerating stats: increase toward max (+5 per interval)
    const regenChanges: any = {
      consciousness: regenAmount,
      stamina: regenAmount,
      charge: regenAmount,
      bandwidth: regenAmount
    };
    
    // Load stats: if active breaches, INCREASE thermal/neural (+15 per interval per breach), otherwise decrease toward 0 (-5 per interval)
    if (activeBreachCount > 0) {
      // During breach(es): thermal and neural increase (+15 per breach per interval)
      const loadIncrease = cappedIntervals * 15 * activeBreachCount;
      regenChanges.thermal = loadIncrease;
      regenChanges.neural = loadIncrease;
    } else {
      // Normal regeneration: thermal and neural decrease
      regenChanges.thermal = -regenAmount;
      regenChanges.neural = -regenAmount;
    }

    console.log('Regeneration changes:', {
      cappedIntervals,
      activeBreachCount,
      regenChanges
    });

    // Apply changes via StatsService (automatic capping at max values)
    await statsService.modifyStats(regenChanges);

    // Update last_regeneration timestamp
    await pool.execute(
      'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
      [user.id]
    );

    // Get updated stats
    const updatedStats = await statsService.getStats();

    return NextResponse.json({ 
      success: true, 
      stats: updatedStats.current,
      max: updatedStats.max,
      intervalsElapsed: cappedIntervals,
      _source: 'StatsService'
    });
  } catch (err: any) {
    console.error('Regeneration API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to regenerate stats' },
      { status: 500 }
    );
  }
}
