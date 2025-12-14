import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Initialize StatsService
    const statsService = new StatsService(pool, userId);

    // Check for active breaches (count them for thermal/neural calculation)
    const [activeBreachRows] = await pool.execute<any[]>(
      `SELECT id, timestamp FROM user_zone_history 
       WHERE user_id = ? AND action_type = 'Breached' 
       AND (result_status IS NULL OR result_status = '') 
       AND end_time > UTC_TIMESTAMP()`,
      [userId]
    );
    const activeBreachCount = activeBreachRows.length;

    // Get current stats and last regeneration timestamp
    // Also get current UTC time from database to ensure consistency
    const [statsRows] = await pool.execute<any[]>(
      'SELECT *, last_regeneration, UTC_TIMESTAMP() as db_now FROM user_stats WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const stats = (statsRows as any[])[0];

    if (!stats) {
      return NextResponse.json({ error: 'Stats not found' }, { status: 404 });
    }

    // If last_regeneration is NULL, initialize it to now
    if (!stats.last_regeneration) {
      logger.debug('Initializing last_regeneration to current UTC time', { fid });
      await pool.execute(
        'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
        [userId]
      );
      return NextResponse.json({ success: true, stats, intervalsElapsed: 0 });
    }

    // Calculate time elapsed since last regeneration using database UTC time
    const dbNow = new Date(stats.db_now);
    const lastRegen = new Date(stats.last_regeneration);
    const msElapsed = dbNow.getTime() - lastRegen.getTime();
    const intervalsElapsed = Math.floor(msElapsed / (15 * 60 * 1000)); // 15 minutes in ms

    logger.debug('Regeneration calculation', {
      fid,
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
      logger.warn('last_regeneration is in the future, resetting to now', { fid });
      await pool.execute(
        'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
        [userId]
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

    logger.debug('Regeneration changes', {
      fid,
      cappedIntervals,
      activeBreachCount,
      regenChanges
    });

    // Apply changes via StatsService (automatic capping at max values)
    await statsService.modifyStats(regenChanges);

    // Update last_regeneration timestamp
    await pool.execute(
      'UPDATE user_stats SET last_regeneration = UTC_TIMESTAMP() WHERE user_id = ?',
      [userId]
    );

    // Get updated stats
    const updatedStats = await statsService.getStats();

    logger.info('Stats regenerated', { fid, intervalsElapsed: cappedIntervals, activeBreachCount });
    return NextResponse.json({ 
      success: true, 
      stats: updatedStats.current,
      max: updatedStats.max,
      intervalsElapsed: cappedIntervals,
      _source: 'StatsService'
    });
  } catch (err: any) {
    return handleApiError(err, '/api/regenerate');
  }
}
