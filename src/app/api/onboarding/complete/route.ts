import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, classId, stats, unallocatedPoints, alignmentId } = body;

    if (!fid || !classId || !stats || alignmentId === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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
    console.error('Onboarding completion API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
