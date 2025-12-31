import { NextRequest, NextResponse } from 'next/server';
import pool from '../../../../lib/db';
import { getUserFromFid } from '../../../../lib/navUtils';

export async function POST(request: NextRequest, { params }: { params: { gig: string } }) {
  try {
    const { userFid } = await request.json();
    const gigId = parseInt(params.gig, 10);
    if (!userFid || !gigId) {
      return NextResponse.json({ error: 'Missing userFid or gigId' }, { status: 400 });
    }
    const user = await getUserFromFid(userFid);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // Only allow advancing from UNLOCKED to STARTED
    const [rows] = await pool.execute<any[]>(
      'SELECT status FROM gig_history WHERE user_id = ? AND gig_id = ? LIMIT 1',
      [user.id, gigId]
    );
    if (!rows || !rows[0] || String(rows[0].status).toUpperCase() !== 'UNLOCKED') {
      return NextResponse.json({ error: 'Gig not unlocked or already started' }, { status: 400 });
    }
    await pool.execute(
      'UPDATE gig_history SET status = ?, started_at = NOW() WHERE user_id = ? AND gig_id = ?',
      ['started', user.id, gigId]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to start gig' }, { status: 500 });
  }
}
