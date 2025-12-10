import React from 'react';
import { FrameHeader, CxCard, NavStrip } from '../../components/CxShared';
import { getDbPool } from '../../lib/db';
import { getNavStripData } from '../../lib/navUtils';

export default async function GigsPage({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  let gigs: Array<any> = [];
  let errorMsg = '';
  
  // Await searchParams
  const resolvedSearchParams = await searchParams;
  
  // Fetch NavStrip data for test user
  const navData = await getNavStripData(300187);

  try {
    const pool = await getDbPool();

    // Resolve the user id from the dev fid
    const [userRows] = await pool.execute<any[]>('SELECT id FROM users WHERE fid = ? LIMIT 1', [300187]);
    const user = (userRows as any)[0];
    if (!user) {
      errorMsg = 'User not found for test fid.';
      return (
        <div className="frame-container frame-main">
          <FrameHeader />
          <div className="frame-body">
            <div className="p-6 text-red-400">{errorMsg}</div>
          </div>
        </div>
      );
    }

    // Fetch all gigs unlocked by this user from gig_history
    const [ghRows] = await pool.execute<any[]>('SELECT gh.gig_id, gh.unlocked_at, gh.status FROM gig_history gh WHERE gh.user_id = ? ORDER BY gh.unlocked_at DESC', [user.id]);

    // For each gig_id, fetch full gig details and requirements
    for (const row of (ghRows as any[])) {
      const gigId = row.gig_id;
      const [gigRows] = await pool.execute<any[]>('SELECT * FROM gigs WHERE id = ? LIMIT 1', [gigId]);
      const gRow = (gigRows as any[])[0] ?? {};

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.debug('gigs page - gig row:', { gigId, gRow });
      }

      const id = gRow.id ?? gigId;
      const gig_code = gRow.gig_code ?? gRow.code ?? null;
      const title = gRow.gig_name ?? gRow.title ?? gRow.name ?? `Gig ${id}`;
      const image_url = gRow.image_url ?? gRow.img ?? gRow.image ?? null;
      const description = gRow.gig_desc ?? gRow.gigDesc ?? gRow.description ?? gRow.desc ?? '';
      const contact_id = gRow.contact ?? null;
      const unlocked_at = row.unlocked_at ?? null;
      const status = row.status ?? null;

      // Load requirements for this gig
      const requirements: Array<{ text: string; met: boolean }> = [];
      try {
        const [reqRows] = await pool.execute<any[]>('SELECT * FROM gig_requirements WHERE gig_id = ? LIMIT 1', [id]);
        const reqRow = (reqRows as any[])[0] ?? null;
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug('gig requirements raw row:', reqRow);
        }
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
        // eslint-disable-next-line no-console
        console.debug('gig requirements lookup failed', e?.stack ?? e);
      }

      // Fetch contact display_name for this gig (and image)
      let contact_name = '';
      let contact_image_url: string | null = null;
      if (contact_id) {
        try {
          const [cRows] = await pool.execute<any[]>('SELECT display_name AS name, image_url FROM contacts WHERE id = ? LIMIT 1', [contact_id]);
          const crow = (cRows as any[])[0] ?? null;
          contact_name = crow?.name ?? '';
          contact_image_url = crow?.image_url ?? null;
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.debug('contact name lookup failed', e?.stack ?? e);
        }
      }

      // Determine status pill (NEW with pulse, COMPLETED/UNAVAILABLE without pulse, or none)
      const now = new Date();
      const unlockedDate = unlocked_at ? new Date(unlocked_at) : null;
      const hoursAgo = unlockedDate ? (now.getTime() - unlockedDate.getTime()) / (1000 * 60 * 60) : null;
      const statusNorm = String(status ?? '').toUpperCase();
      
      let statusPill: { label: string; className: string } | null = null;
      
      if (statusNorm === 'COMPLETED') {
        statusPill = { label: 'COMPLETED', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' };
      } else if (statusNorm === 'UNLOCKED' && hoursAgo !== null && hoursAgo <= 72) {
        statusPill = { label: 'NEW', className: 'bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse' };
      } else if (statusNorm !== '' && statusNorm !== 'UNLOCKED') {
        // Any other status (LOCKED, UNAVAILABLE, etc.)
        statusPill = { label: statusNorm === 'LOCKED' ? 'LOCKED' : 'UNAVAILABLE', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' };
      }

      gigs.push({ id, gig_code, title, image_url, description, contact_id, contact_name, contact_image_url, requirements, unlocked_at, status, statusPill });
    }
  } catch (err: any) {
    errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
    // eslint-disable-next-line no-console
    console.error('Gigs page error', err?.stack || err);
  }

  if (errorMsg) {
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load gigs</div>
          <div className="text-sm text-gray-300 mb-2">{errorMsg}</div>
        </div>
      </div>
    );
  }

  // Determine sort mode from query string
  const sortRaw = (resolvedSearchParams?.sort ?? 'newest');
  const sortMode = Array.isArray(sortRaw) ? (sortRaw[0] ?? 'newest') : String(sortRaw);
  const isContactMode = sortMode.toLowerCase() === 'contact';

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
          <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-bright-blue flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">GIGS</div>
        </div>
      <div className="frame-body">

        {/* Sort filter */}
        <div className="flex items-center gap-3 mb-4 uppercase">
          <span className="text-gray-400 text-sm text-bold">Sort</span>
          {isContactMode ? (
            <>
              <a href="/gigs?sort=newest" className="meta-eyebrow hover:underline">Newest</a>

              <span className="pill-cloud-gray px-2 py-0.5">Contact</span>
            </>
          ) : (
            <>
              <span className="pill-cloud-gray px-2 py-0.5">Newest</span>

              <a href="/gigs?sort=contact" className="meta-eyebrow hover:underline">Contact</a>
            </>
          )}
        </div>

        {/* Gigs list */}
        {!isContactMode ? (
          <div className="space-y-2">
            {gigs.length === 0 && <div className="text-gray-400 p-4">No unlocked gigs.</div>}

            {gigs.map((g: any) => (
              <div key={g.id}>
                  <CxCard href={`/gigs/${g.id}`} className="cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="flex flex-col gap-4">

                      <div className="flex flex-row items-start gap-4">

                        <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                        </div>

                        <div className="flex-1">

                          <div className="flex items-center justify-between gap-2">
                            <div className="meta-eyebrow">{g.gig_code}</div>
                            {g.statusPill && <div className={g.statusPill.className}>{g.statusPill.label}</div>}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="card-title">{g.title}</div>
                          </div>

                          <div className="mt-1">
                              <span className="meta-heading text-sm">Requirements:</span>{' '}
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

                        </div>

                      </div>

                    </div>
                  </CxCard>
              </div>
            ))}

          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              // Group by contact_id
              const groups = new Map<string, any[]>();
              for (const g of gigs) {
                const key = String(g.contact_id ?? 'unknown');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(g);
              }

              const entries: React.ReactNode[] = [];
              for (const [key, items] of groups.entries()) {
                const first = items[0] ?? {};
                const name = first.contact_name || 'Unknown Contact';
                const img = first.contact_image_url || null;
                entries.push(
                  <div key={`group-${key}`}>
                    
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <div className="w-6 h-6 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                        {img ? <img src={img} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                      </div>
                      <div className="meta-heading text-sm">{name}</div>
                    </div>

                    <div className="space-y-3">
                      {items.map((g: any) => (
                        <div key={g.id}>
                          <CxCard href={`/gigs/${g.id}`} className="cursor-pointer hover:opacity-90 transition-opacity">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-row items-start gap-4">
                                <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                                  {g.image_url ? <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="meta-eyebrow">{g.gig_code}</div>
                                    {g.statusPill && <div className={g.statusPill.className}>{g.statusPill.label}</div>}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="card-title">{g.title}</div>
                                  </div>
                                  <div className="mt-1">
                                    <span className="meta-heading text-sm">Requirements:</span>{' '}
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
                                </div>
                              </div>
                            </div>
                          </CxCard>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return entries;
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
