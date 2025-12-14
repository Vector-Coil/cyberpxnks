import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid } from '~/lib/api/errors';
import { getUserByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  try {
    const dbPool = await getDbPool();
    const POINTS_PER_LEVEL = 2; // Award 2 stat points per level

    // Get user's current level and XP
    const user = await getUserByFid(dbPool, fid);
    const currentLevel = user.level || 1;
    const currentXp = user.xp || 0;

    // Get the XP threshold for the next level
    const nextLevel = currentLevel + 1;
    const [thresholdRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT xp_required FROM level_thresholds WHERE level = ?',
      [nextLevel]
    );

    // If no threshold found, user is at max level
    if (thresholdRows.length === 0) {
      return NextResponse.json({
        leveledUp: false,
        currentLevel,
        currentXp,
        message: 'Max level reached'
      });
    }

    const xpRequired = thresholdRows[0].xp_required;

    // Check if user has enough XP to level up
    if (currentXp >= xpRequired) {
      // Update user's level and award stat points
      await dbPool.query(
        'UPDATE users SET level = ?, unallocated_points = unallocated_points + ? WHERE id = ?',
        [nextLevel, POINTS_PER_LEVEL, user.id]
      );

      // Cap stats at new max values (cognition/power/resilience may have increased)
      const statsService = new StatsService(dbPool, user.id);
      await statsService.capAtMax();

      // Log level up activity
      await logActivity(
        user.id,
        'progression',
        'level_up',
        nextLevel,
        null,
        `Leveled up to level ${nextLevel}, earned ${POINTS_PER_LEVEL} stat points`
      );

      // Check if there are more levels to go (recursive level-up check)
      let finalLevel = nextLevel;
      let levelsGained = 1;

      // Keep checking for additional level-ups
      while (true) {
        const checkLevel = finalLevel + 1;
        const [nextThresholdRows] = await dbPool.query<RowDataPacket[]>(
          'SELECT xp_required FROM level_thresholds WHERE level = ?',
          [checkLevel]
        );

        if (nextThresholdRows.length === 0) break; // Max level reached
        
        const nextXpRequired = nextThresholdRows[0].xp_required;
        if (currentXp < nextXpRequired) break; // Not enough XP for next level

        // Level up again and award more points
        await dbPool.query(
          'UPDATE users SET level = ?, unallocated_points = unallocated_points + ? WHERE id = ?',
          [checkLevel, POINTS_PER_LEVEL, user.id]
        );

        // Cap stats at new max values
        const statsService = new StatsService(dbPool, user.id);
        await statsService.capAtMax();

        await logActivity(
          user.id,
          'progression',
          'level_up',
          checkLevel,
          null,
          `Leveled up to level ${checkLevel}, earned ${POINTS_PER_LEVEL} stat points`
        );

        finalLevel = checkLevel;
        levelsGained++;
      }

      const totalPointsAwarded = levelsGained * POINTS_PER_LEVEL;
      
      logger.info('Level up completed', { fid, oldLevel: currentLevel, newLevel: finalLevel, levelsGained, totalPointsAwarded });
      return NextResponse.json({
        leveledUp: true,
        oldLevel: currentLevel,
        newLevel: finalLevel,
        levelsGained,
        pointsAwarded: totalPointsAwarded,
        currentXp
      });
    }

    return NextResponse.json({
      leveledUp: false,
      currentLevel,
      currentXp,
      xpRequired,
      xpToNextLevel: xpRequired - currentXp
    });
  } catch (error) {
    return handleApiError(error, '/api/check-level-up');
  }
}
