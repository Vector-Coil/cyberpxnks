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
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const pool = await getDbPool();

    const [reqRows] = await pool.execute<any[]>('SELECT * FROM gig_requirements WHERE gig_id = ? LIMIT 1', [gigId]);
    const reqRow = (reqRows as any[])[0] ?? null;
    if (!reqRow) {
      return NextResponse.json({ requirements: [], allRequirementsMet: true });
    }

    const keys = Object.keys(reqRow || {});
    const objectiveKeys = keys.filter(k => /(^obj\b|^obj_|^objective|^objective_|^obj\d|obj_\d)/i.test(k)).slice(0, 5);

    const requirements: Array<{ text: string; met: boolean }> = [];

    for (const key of objectiveKeys) {
      const raw = (reqRow as any)[key] ?? null;
      if (!raw || String(raw).trim() === '') continue;
      const parts = String(raw).split('_');
      const type = parts[0] ?? '';
      const idNum = parts.length > 1 ? parseInt(parts[1], 10) : null;
      let text = String(raw);
      let met = false;

      if (type === 'gig' && idNum) {
        const [ginfoRows] = await pool.execute<any[]>('SELECT gig_code FROM gigs WHERE id = ? LIMIT 1', [idNum]);
        const ginfo = (ginfoRows as any[])[0] ?? null;
        text = ginfo?.gig_code ?? `Gig ${idNum}`;

        const [ghCheckRows] = await pool.execute<any[]>('SELECT status, last_completed_at FROM gig_history WHERE user_id = ? AND gig_id = ? LIMIT 1', [user.id, idNum]);
        const ghCheck2 = (ghCheckRows as any[])[0] ?? null;
        met = !!(ghCheck2 && ((ghCheck2.status && String(ghCheck2.status).toUpperCase() === 'COMPLETED') || ghCheck2.last_completed_at));

      } else if (type === 'contact' && idNum) {
        const [cRows] = await pool.execute<any[]>('SELECT display_name AS name FROM contacts WHERE id = ? LIMIT 1', [idNum]);
        const crow = (cRows as any[])[0] ?? null;
        text = crow?.name ?? `Contact ${idNum}`;

        const [chCheckRows] = await pool.execute<any[]>('SELECT id FROM contact_history WHERE user_id = ? AND contact_id = ? LIMIT 1', [user.id, idNum]);
        met = Array.isArray(chCheckRows) && (chCheckRows as any[]).length > 0;

      } else if (type === 'item' && idNum) {
        const [itemRows] = await pool.execute<any[]>('SELECT name FROM items WHERE id = ? LIMIT 1', [idNum]);
        const item = (itemRows as any[])[0] ?? null;
        text = item?.name ?? `Item ${idNum}`;

        const [invRows] = await pool.execute<any[]>('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1', [user.id, idNum]);
        met = Array.isArray(invRows) && (invRows as any[]).length > 0 && (invRows as any[])[0].quantity > 0;

      } else {
        met = false;
      }

      requirements.push({ text, met });
    }

    const allRequirementsMet = requirements.length === 0 || requirements.every(r => r.met === true);
    return NextResponse.json({ requirements, allRequirementsMet });
  } catch (e: any) {
    console.error('Validate gig API error:', e?.stack || e);
    return NextResponse.json({ error: 'Failed to validate gig', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
