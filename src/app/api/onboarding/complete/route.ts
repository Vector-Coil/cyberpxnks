import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { requireParams, handleApiError } from '../../../../lib/api/errors';
import { logger } from '../../../../lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    requireParams(body, ['fid', 'classId', 'stats', 'alignmentId']);
    const { fid, classId, stats, unallocatedPoints, alignmentId } = body;

    const pool = await getDbPool();

    // Insert new user with onboarding data
    await pool.execute(
      `INSERT INTO users (
        fid, username, class_id, alignment_id,
        cognition, insight, interface, power, resilience, agility,
        unallocated_points, level, xp, credits, initialized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, NOW())`,
      [
        fid,
        `user_${fid}`, // Placeholder username
        classId,
        alignmentId,
        stats.cognition,
        stats.insight,
        stats.interface,
        stats.power,
        stats.resilience,
        stats.agility,
        unallocatedPoints
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return handleApiError(err, 'Failed to complete onboarding');
  }
}
