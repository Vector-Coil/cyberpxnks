import React from 'react';
import { redirect } from 'next/navigation';
import { FrameHeader, CxCard, NavStrip } from '../../../components/CxShared';
import { getDbPool } from '../../../lib/db';
import { getNavStripData } from '../../../lib/navUtils';

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
    const objective = gRow.objective ?? gRow.objective_text ?? '';
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
    const historyEvents: React.ReactNode[] = [];
    try {
      const [historyRows] = await pool.execute<any[]>('SELECT * FROM gig_history WHERE user_id = ? AND gig_id = ? ORDER BY id ASC', [user.id, id]);
      for (const hr of (historyRows as any[])) {
        if (hr.unlocked_at) {
          historyEvents.push(
            <div key={`u-${hr.id ?? hr.unlocked_at}`} className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/><path d="M17 8V7a5 5 0 10-10 0v1H5v11h14V8h-2zM9 7a3 3 0 116 0v1H9V7z" fill="currentColor"/></svg>
              <div>Gig unlocked {(new Date(hr.unlocked_at)).toLocaleDateString('en-US')}</div>
            </div>
          );
        }

        if ((hr.refreshed_at) || (hr.status && String(hr.status).toUpperCase().includes('REFRESH'))) {
          const d = hr.refreshed_at ?? hr.updated_at ?? hr.unlocked_at;
          if (d) historyEvents.push(
            <div key={`r-${hr.id ?? d}`} className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 12a9 9 0 10-3.1 6.6L20 20v-5.1l-1.1.1A7 7 0 1119 12h2z" fill="currentColor"/></svg>
              <div>Gig refresh {(new Date(d)).toLocaleDateString('en-US')}</div>
            </div>
          );
        }

        if (hr.last_completed_at) {
          const gain = hr.gain ?? hr.xp_gain ?? hr.xp ?? hr.reward ?? hr.points ?? hr.xp_gained ?? null;
          historyEvents.push(
            <div key={`c-${hr.id ?? hr.last_completed_at}`} className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="flex items-center gap-2">
                <div>Completed {(new Date(hr.last_completed_at)).toLocaleDateString('en-US')}</div>
                {gain ? <span className="pill-cloud-gray">{String(gain)}</span> : null}
              </div>
            </div>
          );
        }
      }

      if (historyEvents.length === 0 && Array.isArray(historyRows) && (historyRows as any[]).length > 0) {
        const hr = (historyRows as any[])[0];
        if (hr.unlocked_at) historyEvents.push(
          <div key={`u-fallback-${hr.id ?? hr.unlocked_at}`} className="flex items-center gap-3 text-gray-300">
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/><path d="M17 8V7a5 5 0 10-10 0v1H5v11h14V8h-2zM9 7a3 3 0 116 0v1H9V7z" fill="currentColor"/></svg>
            <div>Gig unlocked {(new Date(hr.unlocked_at)).toLocaleDateString('en-US')}</div>
          </div>
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.debug('history fetch failed', e);
    }

    return (
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
          />
        </div>
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
          <a href="/gigs" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">GIGS</div>
        </div>
        <div className="frame-body">

          <div className="mb-6">
            <div className="w-full mb-4 overflow-hidden rounded">
              {image_url ? (
                <img src={image_url} alt={title} className="w-full h-auto object-cover" />
              ) : (
                <div className="w-full h-64 bg-gray-600" />
              )}
            </div>

            <div className="flex flex-col">

              <div className="text-center mb-0">
                {gig_code && (
                  <span className="text-l font-bold uppercase text-white inline-block">{gig_code}</span>
                )}
                {isNew && (
                  <span className="inline-block ml-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse">NEW</span>
                )}
              </div>



              <div className="text-xl font-bold uppercase text-white mt-2 text-center">{title}</div>



              <div className="mt-4 mb-3  text-gray-300">{description}</div>

              <div className="mb-1">
                <span className="meta-heading">Requirements:</span>{' '}
                {requirements && requirements.length > 0 ? (
                  <span>
                    {requirements.map((r, i) => (
                      <span key={i} className={r.met ? 'text-blue-400' : 'text-red-300'}>{r.text}{i < requirements.length - 1 ? ', ' : ''}</span>
                    ))}
                  </span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </div>

              <div className="mb-1">
                <span className="meta-heading">Objective:</span>{' '}
                <span className="text-gray-300">{objective || 'None'}</span>
              </div>

              <div className="mb-3">
                <span className="meta-heading">Contact:</span> 
                <a href={`/contacts/${contact_id}`}>{contact_name}</a>
              </div>

            </div>
          </div>

          
            <div className="pb-4">

              <div className="mt-3">
                {/* CTA button */}
                {(() => {
                  const statusNorm = (status ?? '').toString().toUpperCase();
                  let btnLabel = 'BEGIN GIG';
                  let isDisabled = false;
                  let btnClass = 'btn-cx btn-cx-primary btn-cx-full';

                  if (statusNorm === 'COMPLETED') {
                    btnLabel = 'COMPLETED';
                    isDisabled = true;
                    btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                  } else if (statusNorm !== '' && statusNorm !== 'UNLOCKED') {
                    btnLabel = statusNorm === 'LOCKED' ? 'LOCKED' : 'UNAVAILABLE';
                    isDisabled = true;
                    btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                  }

                  if (isDisabled) {
                    return (<button className={btnClass} disabled aria-disabled="true">{btnLabel}</button>);
                  }

                  return (
                    <a href={`/gigs/${id}/play`}>
                      <button className={btnClass}>{btnLabel}</button>
                    </a>
                  );
                })()}
              </div>

              {/* Gig History section */}
              <div className="card-dark mt-4">
                <h3 className="text-center meta-heading">Gig History</h3>

                <div className="mt-4 space-y-3">
                  {historyEvents && historyEvents.length > 0 ? (
                    historyEvents
                  ) : (
                    <div className="text-gray-400 text-center">No history</div>
                  )}
                </div>

              </div>

            </div>
          

        </div>
            </div>
    );

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
