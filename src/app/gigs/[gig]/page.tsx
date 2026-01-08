import React from 'react';
import { redirect } from 'next/navigation';
import { FrameHeader, CxCard, NavStrip } from '../../../components/CxShared';
import { getDbPool } from '../../../lib/db';
import { getNavStripData } from '../../../lib/navUtils';
import GigDetailClient from './GigDetailClient';

export default async function GigDetailPage({ params }: { params: any }) {
  const p = await params;
  const gigId = parseInt(p.gig, 10);
  if (Number.isNaN(gigId)) {
    return (<div className="p-6 text-red-400">Invalid gig id</div>);
  }

  // Fetch NavStrip data for test user
  const navData = await getNavStripData(300187);

  try {
    const pool = await getDbPool();

    // Resolve the user id from the dev fid
    const [userRows] = await pool.execute<any[]>('SELECT id FROM users WHERE fid = ? LIMIT 1', [300187]);
    const user = (userRows as any)[0];
    if (!user) {
      return (<div className="p-6 text-red-400">User not found for test fid.</div>);
    }

    // Ensure the current user has unlocked this gig (in gig_history); if not, redirect to the gigs list
    const [ghCheck] = await pool.execute<any[]>('SELECT id, unlocked_at, status, last_completed_at FROM gig_history WHERE user_id = ? AND gig_id = ? LIMIT 1', [user.id, gigId]);
    const ghRow = (ghCheck as any[])[0] ?? null;
    if (!ghRow) {
      redirect('/gigs');
    }

    // Load gig row
    const [gRows] = await pool.execute<any[]>('SELECT * FROM gigs WHERE id = ? LIMIT 1', [gigId]);
    const gRow = (gRows as any[])[0] ?? null;
    if (!gRow) {
      return (<div className="p-6 text-gray-300">Gig not found.</div>);
    }

    const id = gRow.id ?? gigId;
    const gig_code = gRow.gig_code ?? gRow.code ?? null;
    const title = gRow.gig_code ?? gRow.title ?? gRow.name ?? `Gig ${id}`;
    const image_url = gRow.image_url ?? gRow.img ?? gRow.image ?? null;
    const description = gRow.gig_desc ?? gRow.gigDesc ?? gRow.description ?? gRow.desc ?? '';
    const contact_id = gRow.contact ?? null;
    const unlocked_at = ghRow.unlocked_at ?? null;
    const status = ghRow.status ?? null;

    // isNew: unlocked within 72 hours and still UNLOCKED
    const now = new Date();
    const unlockedDate = unlocked_at ? new Date(unlocked_at) : null;
    const hoursAgo = unlockedDate ? (now.getTime() - unlockedDate.getTime()) / (1000 * 60 * 60) : null;
    const isNew = !!(hoursAgo !== null && hoursAgo <= 72 && String(status ?? '').toUpperCase() === 'UNLOCKED');

    // Load requirements (flexible column detection)
    const requirements: Array<{ text: string; met: boolean }> = [];
    try {
      const [reqRows] = await pool.execute<any[]>('SELECT * FROM gig_requirements WHERE gig_id = ? LIMIT 1', [id]);
      const reqRow = (reqRows as any[])[0] ?? null;
      if (reqRow) {
        const keys = Object.keys(reqRow || {});
        const candidateKeys = keys.filter(k => /(^req\b|req_|requirement|requirement\b|^r\d)/i.test(k));
        const reqKeys = candidateKeys.slice(0, 3);
        for (const key of reqKeys) {
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
            // Item requirement: check user's inventory for the item (non-consuming)
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
      }
    } catch (e: any) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.debug('gig requirements lookup failed', e?.stack ?? e);
    }

    // Contact info
    let contact_name = '';
    if (contact_id) {
      try {
        const [cRows] = await pool.execute<any[]>('SELECT display_name AS name FROM contacts WHERE id = ? LIMIT 1', [contact_id]);
        const crow = (cRows as any[])[0] ?? null;
        contact_name = crow?.name ?? '';
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.debug('contact lookup failed', e?.stack ?? e);
      }
    }

    // Fetch gig history rows and build renderable events (server-side)
    const historyEvents: Array<{ type: 'unlocked' | 'refreshed' | 'completed'; date: string; gain?: string | null }> = [];
    try {
      const [historyRows] = await pool.execute<any[]>('SELECT * FROM gig_history WHERE user_id = ? AND gig_id = ? ORDER BY id ASC', [user.id, id]);
      for (const hr of (historyRows as any[])) {
        if (hr.unlocked_at) {
          historyEvents.push({
            type: 'unlocked',
            date: hr.unlocked_at
          });
        }

        if ((hr.refreshed_at) || (hr.status && String(hr.status).toUpperCase().includes('REFRESH'))) {
          const d = hr.refreshed_at ?? hr.updated_at ?? hr.unlocked_at;
          if (d) {
            historyEvents.push({
              type: 'refreshed',
              date: d
            });
          }
        }

        if (hr.last_completed_at) {
          const gain = hr.gain ?? hr.xp_gain ?? hr.xp ?? hr.reward ?? hr.points ?? hr.xp_gained ?? null;
          historyEvents.push({
            type: 'completed',
            date: hr.last_completed_at,
            gain: gain ? String(gain) : null
          });
        }
      }

      if (historyEvents.length === 0 && Array.isArray(historyRows) && (historyRows as any[]).length > 0) {
        const hr = (historyRows as any[])[0];
        if (hr.unlocked_at) {
          historyEvents.push({
            type: 'unlocked',
            date: hr.unlocked_at
          });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.debug('history fetch failed', e);
    }

    const gigData = {
      id,
      gig_code,
      title,
      image_url,
      description,
      contact_id,
      contact_name,
      status,
      isNew,
      requirements,
      objective: gRow.objective ?? gRow.gig_objective ?? gRow.gigObjective ?? null
    };

    const navDataWithDefaults = {
      ...navData,
      profileImage: navData.profileImage ?? '',
      cxBalance: 0 // Will be updated on client side from wallet
    };

    return <GigDetailClient gigData={gigData} historyEvents={historyEvents} navData={navDataWithDefaults} userFid={300187} />;

  } catch (err: any) {
    console.error('Gig detail error', err?.stack || err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load gig</div>
          <div className="text-sm text-gray-300 mb-2">{message}</div>
          <div className="text-xs text-gray-500">Check database configuration and connectivity.</div>
        </div>
      </div>
    );
  }
}
