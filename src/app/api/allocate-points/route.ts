import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../lib/db';
import { StatsService } from '../../../lib/statsService';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  try {
    const dbPool = await getDbPool();
    const body = await request.json();
    const { allocations } = body; // { cognition: 1, power: 2, etc. }

    if (!allocations || typeof allocations !== 'object') {
      return NextResponse.json({ error: 'Invalid allocations format' }, { status: 400 });
    }

    // Validate that all allocations are non-negative integers
    const validStats = ['cognition', 'insight', 'interface', 'power', 'resilience', 'agility'];
    let totalPointsToSpend = 0;

    for (const [stat, points] of Object.entries(allocations)) {
      if (!validStats.includes(stat)) {
        return NextResponse.json({ error: `Invalid stat: ${stat}` }, { status: 400 });
      }

      const pointValue = Number(points);
      if (!Number.isInteger(pointValue) || pointValue < 0) {
        return NextResponse.json({ 
          error: `Invalid point value for ${stat}: must be non-negative integer` 
        }, { status: 400 });
      }

      totalPointsToSpend += pointValue;
    }

    // Start transaction for atomic update
    const connection = await dbPool.getConnection();
    await connection.beginTransaction();

    try {
      // Get user with lock to prevent race conditions
      const [userRows] = await connection.query<RowDataPacket[]>(
        'SELECT id, unallocated_points, cognition, insight, interface, power, resilience, agility FROM users WHERE fid = ? FOR UPDATE',
        [fid]
      );

      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userRows[0];
      const availablePoints = user.unallocated_points || 0;

      // Validate user has enough points
      if (totalPointsToSpend > availablePoints) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ 
          error: `Insufficient points. Have ${availablePoints}, trying to spend ${totalPointsToSpend}` 
        }, { status: 400 });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: number[] = [];

      for (const [stat, points] of Object.entries(allocations)) {
        if (Number(points) > 0) {
          updates.push(`${stat} = ${stat} + ?`);
          values.push(Number(points));
        }
      }

      // Deduct points
      updates.push('unallocated_points = unallocated_points - ?');
      values.push(totalPointsToSpend);
      values.push(user.id);

      // Execute update
      await connection.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      // Commit transaction
      await connection.commit();
      connection.release();

      // Log allocation (after transaction is complete)
      const allocationDetails = Object.entries(allocations)
        .filter(([_, points]) => Number(points) > 0)
        .map(([stat, points]) => `${stat}:+${points}`)
        .join(', ');

      await logActivity(
        user.id,
        'progression',
        'stat_allocation',
        totalPointsToSpend,
        null,
        `Allocated ${totalPointsToSpend} points: ${allocationDetails}`
      );

      // Get updated user stats using the pool (after connection is released)
      const [updatedUserRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT cognition, insight, interface, power, resilience, agility, unallocated_points FROM users WHERE id = ?',
        [user.id]
      );

      return NextResponse.json({
        success: true,
        pointsSpent: totalPointsToSpend,
        remainingPoints: updatedUserRows[0].unallocated_points,
        updatedStats: {
          cognition: updatedUserRows[0].cognition,
          insight: updatedUserRows[0].insight,
          interface: updatedUserRows[0].interface,
          power: updatedUserRows[0].power,
          resilience: updatedUserRows[0].resilience,
          agility: updatedUserRows[0].agility
        }
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err: any) {
    console.error('Allocate points API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to allocate points' },
      { status: 500 }
    );
  }
}
