import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { getUserByFid } from '../../../../../lib/navUtils';

export async function POST(request: NextRequest, context: { params: Promise<{ gig: string }> }) {
  try {
    const { gig } = await context.params;
    const { userFid } = await request.json();
    const gigId = parseInt(gig, 10);
    if (!userFid || !gigId) {
      return NextResponse.json({ error: 'Missing userFid or gigId' }, { status: 400 });
    }

    const user = await getUserByFid(userFid);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const pool = await getDbPool();

    // Ensure gig exists
    const [gRows] = await pool.execute<any[]>('SELECT id, reward_item, reward_credits FROM gigs WHERE id = ? LIMIT 1', [gigId]);
    const gRow = (gRows as any[])[0] ?? null;
    if (!gRow) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Ensure user has a started gig entry
    const [ghRows] = await pool.execute<any[]>('SELECT id, status, completed_count FROM gig_history WHERE user_id = ? AND gig_id = ? LIMIT 1', [user.id, gigId]);
    const ghRow = (ghRows as any[])[0] ?? null;
    if (!ghRow || !ghRow.status || !['started','in progress','in_progress','inprogress'].includes(String(ghRow.status).toLowerCase())) {
      return NextResponse.json({ error: 'Gig not started or already completed' }, { status: 400 });
    }

    // Grant rewards (do not consume requirements)
    const grantedItems: any[] = [];
    if (gRow.reward_item) {
      // Add item to inventory (increment)
      await pool.execute(
        `INSERT INTO user_inventory (user_id, item_id, quantity, acquired_at)
         VALUES (?, ?, 1, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [user.id, gRow.reward_item]
      );
      const [itemRows] = await pool.execute<any[]>('SELECT name FROM items WHERE id = ? LIMIT 1', [gRow.reward_item]);
      const item = (itemRows as any[])[0] ?? null;
      if (item) grantedItems.push({ id: gRow.reward_item, name: item.name });
    }

    if (gRow.reward_credits && Number(gRow.reward_credits) > 0) {
      await pool.execute('UPDATE users SET credits = credits + ? WHERE id = ?', [gRow.reward_credits, user.id]);
    }

    // Update gig_history to mark completed and increment completed_count
    await pool.execute(
      `UPDATE gig_history SET status = 'completed', last_completed_at = NOW(), completed_count = COALESCE(completed_count, 0) + 1, gain = ? WHERE user_id = ? AND gig_id = ?`,
      [
        `${gRow.reward_credits ? `+${gRow.reward_credits} Credits` : ''}${grantedItems.length ? (gRow.reward_credits ? '; ' : '') + grantedItems.map(i => i.name).join(', ') : ''}`,
        user.id,
        gigId
      ]
    );

    return NextResponse.json({ ok: true, grantedItems });
  } catch (e: any) {
    console.error('Complete gig API error:', e?.stack || e);
    return NextResponse.json({ error: 'Failed to complete gig', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
