import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../lib/db';
import { getUserByFid, getNavStripData } from '../../../../../lib/navUtils';

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

    // Capture pre-existing gig_history entries so we can detect newly-unlocked gigs
    const [preGhRows] = await pool.execute<any[]>('SELECT gig_id FROM gig_history WHERE user_id = ?', [user.id]);
    const preGigIds = new Set((preGhRows as any[]).map(r => r.gig_id));

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
      `UPDATE gig_history SET status = 'completed', last_completed_at = NOW(), completed_count = COALESCE(completed_count, 0) + 1 WHERE user_id = ? AND gig_id = ?`,
      [user.id, gigId]
    );

    // Trigger nav checks which may auto-unlock other gigs (this inserts gig_history rows)
    try {
      await getNavStripData(userFid);
    } catch (e) {
      // non-fatal
      console.debug('NavStrip unlock trigger failed', e);
    }

    // Fetch newly unlocked gigs (those not present in preGigIds)
    const newUnlocked: any[] = [];
    try {
      const [newRows] = await pool.execute<any[]>(
        `SELECT gh.gig_id as id, g.gig_code as gig_code, g.title as title
         FROM gig_history gh
         JOIN gigs g ON gh.gig_id = g.id
         WHERE gh.user_id = ? AND gh.unlocked_at IS NOT NULL`,
        [user.id]
      );
      for (const r of (newRows as any[])) {
        if (!preGigIds.has(r.id) && r.id !== gigId) {
          newUnlocked.push({ id: r.id, gig_code: r.gig_code ?? r.title ?? `Gig ${r.id}` });
        }
      }
    } catch (e) {
      console.debug('Failed to fetch newly unlocked gigs', e);
    }

    const result = {
      credits: gRow.reward_credits ? Number(gRow.reward_credits) : 0,
      items: grantedItems,
      unlockedGigs: newUnlocked
    };

    return NextResponse.json({ ok: true, results: result });
  } catch (e: any) {
    console.error('Complete gig API error:', e?.stack || e);
    return NextResponse.json({ error: 'Failed to complete gig', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
