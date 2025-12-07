import React from 'react';
import { redirect } from 'next/navigation';
import { FrameHeader, CxCard, NavStrip } from '../../../components/CxShared';
import { getDbPool } from '../../../lib/db';
import { getNavStripData } from '../../../lib/navUtils';

export default async function ContactDetailPage({ params }: { params: any }) {
  // Next.js App Router may provide params as a Promise; await to be safe per the runtime warning.
  const p = await params;
  const contactId = parseInt(p.contact, 10);
  if (Number.isNaN(contactId)) {
    return (<div className="p-6 text-red-400">Invalid contact id</div>);
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

    // Ensure the current user has unlocked this contact; if not, redirect to the contacts list
    const [chRows] = await pool.execute<any[]>('SELECT id FROM contact_history WHERE user_id = ? AND contact_id = ? LIMIT 1', [user.id, contactId]);
    if (!Array.isArray(chRows) || (chRows as any[]).length === 0) {
      // Redirect server-side to the contacts list page
      redirect('/contacts');
    }

    // Pull contact fields: display_name, image_url, intro, class
    const [rows] = await pool.execute<any[]>('SELECT id, display_name AS name, image_url, intro, `class` AS class_name FROM contacts WHERE id = ?', [contactId]);
    const contact = (rows as any)[0];

    if (!contact) {
      return (<div className="p-6 text-gray-300">Contact not found.</div>);
    }

    // Fetch gig_history rows for this user and contact without selecting unknown gig columns directly.
    const [ghRows] = await pool.execute<any[]>('SELECT gh.gig_id AS gig_id, gh.unlocked_at AS unlocked_at, gh.status AS status FROM gig_history gh JOIN gigs g ON gh.gig_id = g.id WHERE gh.user_id = ? AND g.contact = ? ORDER BY gh.unlocked_at DESC', [user.id, contactId]);

    const gigs: Array<any> = [];
    for (const row of (ghRows as any[])) {
      const gigId = row.gig_id;
      // Fetch the gig row with SELECT * to avoid referencing non-existent columns
      const [gigRows] = await pool.execute<any[]>('SELECT * FROM gigs WHERE id = ? LIMIT 1', [gigId]);
      const gRow = (gigRows as any[])[0] ?? {};
      // Helpful debug logging in dev so you can see the exact DB columns returned for a gig
      if (process.env.NODE_ENV === 'development') {
        // Console on server — this will appear in the Next.js dev terminal
        // eslint-disable-next-line no-console
        console.debug('contact page - gig row:', { gigId, gRow });
      }

  // Use the project's actual schema: gig_name, gig_desc, image_url
  const id = gRow.id ?? gigId;
  const gig_code = gRow.gig_code ?? gRow.code ?? null;
  const title = gRow.gig_name ?? gRow.title ?? gRow.name ?? `Gig ${id}`;
  const image_url = gRow.image_url ?? gRow.img ?? gRow.image ?? null;
  const description = gRow.gig_desc ?? gRow.gigDesc ?? gRow.description ?? gRow.desc ?? '';
      const unlocked_at = row.unlocked_at ?? null;
      const status = row.status ?? null;

      // Load gig requirements (req1..req3) and compute whether each is met for this user
      const requirements: Array<{ text: string; met: boolean }> = [];
      try {
        // Try a flexible SELECT in case column names differ (req1 vs req_1 etc)
        const [reqRows] = await pool.execute<any[]>('SELECT * FROM gig_requirements WHERE gig_id = ? LIMIT 1', [id]);
        const reqRow = (reqRows as any[])[0] ?? null;
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug('gig requirements raw row:', reqRow);
        }
        if (reqRow) {
          // pick up to three keys that look like requirement columns
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
              const [ginfoRows] = await pool.execute<any[]>('SELECT gig_code, gig_name FROM gigs WHERE id = ? LIMIT 1', [idNum]);
              const ginfo = (ginfoRows as any[])[0] ?? null;
              text = ginfo?.gig_code ?? ginfo?.gig_name ?? `Gig ${idNum}`;

              const [ghCheckRows] = await pool.execute<any[]>('SELECT status, last_completed_at FROM gig_history WHERE user_id = ? AND gig_id = ? LIMIT 1', [user.id, idNum]);
              const ghCheck = (ghCheckRows as any[])[0] ?? null;
              met = !!(ghCheck && ((ghCheck.status && String(ghCheck.status).toUpperCase() === 'COMPLETED') || ghCheck.last_completed_at));

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
        // non-fatal — just leave requirements empty
        // eslint-disable-next-line no-console
        console.debug('gig requirements lookup failed', e?.stack ?? e);
      }

      gigs.push({ id, title, image_url, description, unlocked_at, status, gig_code, requirements });
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
        <div className="pt-5 pb-2 px-6 flex flex-row gap-1">
          <a href="/contacts" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">CONTACTS</div>
        </div>
        <div className="frame-body">

          {/* Top section outside of cards */}
          <div className="flex direction-row gap-3 mb-6">
            
            <div className="w-28 h-28 bg-gray-700 overflow-hidden flex-shrink-0">
              {contact.image_url ? <img src={contact.image_url} alt={contact.name} className="w-full h-full object-cover" /> : null}
            </div>
            
            <div className="direction-column">
              <div className="card-title uppercase">{contact.name}</div>

              {contact.class_name && <div className="mt-2"><span className="uppercase pill-cloud-gray">{contact.class_name}</span></div>}

              <div className="mt-2 text-gray-300">{contact.intro || 'No intro available.'}</div>
            </div>
          </div>

          {/* Gigs list */}
          <div className="space-y-2">

            {gigs.length === 0 && <div className="text-gray-400 p-4">No unlocked gigs for this contact.</div>}

            {gigs.map(g => (
              <div key={g.id}>
                <CxCard className="">
                    <div className="flex flex-col gap-3">

                        <div className="flex flex-row items-start gap-4">
                            
                            <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                            {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                            </div>

                            <div className="flex-1">

                                <div className="meta-eyebrow">{g.gig_code}</div>

                                <div className="flex items-center justify-between">
                                    <div className="card-title">{g.title}</div>
                                </div>

                            </div>

                        </div>
                
                        <div>

                            {/* Requirements placeholder until a requirements table is added */}
                            <div className="mt-2">
                            <span className="meta-heading">Requirements:</span>{' '}
                            {g.requirements && g.requirements.length > 0 ? (
                                <span>
                                {g.requirements.map((r: any, i: number) => (
                                    <span key={i} className={r.met ? 'text-blue-400' : 'text-red-300'}>{r.text}{i < g.requirements.length - 1 ? ', ' : ''}</span>
                                ))}
                                </span>
                            ) : (
                                <span className="text-gray-400">None</span>
                            )}
                            </div>

                            <div className="mt-1 text-gray-300">{g.description}</div>

                            <div className="mt-4">
                                {/* Button state depends on gig status. Completed or non-UNLOCKED gigs show disabled style */}
                                {(() => {
                                const statusNorm = (g.status ?? '').toString().toUpperCase();
                                let btnLabel = 'TAKE GIG';
                                let isDisabled = false;
                                let btnClass = 'btn-cx btn-cx-primary btn-cx-full';

                                if (statusNorm === 'COMPLETED') {
                                    btnLabel = 'COMPLETED';
                                    isDisabled = true;
                                    btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                                } else if (statusNorm !== '' && statusNorm !== 'UNLOCKED') {
                                    // Any other non-empty, non-UNLOCKED status is treated as inaccessible/locked
                                    btnLabel = statusNorm === 'LOCKED' ? 'LOCKED' : 'UNAVAILABLE';
                                    isDisabled = true;
                                    btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                                }

                                if (isDisabled) {
                                    return (
                                    <button className={btnClass} disabled aria-disabled="true">{btnLabel}</button>
                                    );
                                }

                                // Active BEGIN button links to the gig page
                                return (
                                    <a href={`/gigs/${g.id}`}>
                                    <button className={btnClass}>{btnLabel}</button>
                                    </a>
                                );
                                })()}
                            </div>
                            
                        </div>

                    </div>
                </CxCard>
              </div>
            ))}

          </div>

        </div>
      </div>
    );
  } catch (err: any) {
    // Log full error server-side for debugging
    console.error('Contact detail error', err?.stack || err);

    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load contact</div>
          <div className="text-sm text-gray-300 mb-2">{message}</div>
          <div className="text-xs text-gray-500">Check database configuration (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) and ensure the DB is reachable from this environment.</div>
        </div>
      </div>
    );
  }
}

