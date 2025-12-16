'use client';
import React, { useState, useEffect } from 'react';
import { FrameHeader, CxCard, NavStrip } from '../../components/CxShared';
import NavDrawer from '../../components/NavDrawer';
import { useNavData } from '../../hooks/useNavData';

interface Gig {
  id: number;
  title: string;
  description: string;
  reward: number;
  posted_at: string;
  state: string;
  post_fid: number | null;
  is_active: boolean;
  posted_by_username: string | null;
  posted_by_pfp: string | null;
  posted_by_display_name: string | null;
  item1_name: string | null;
  item1_qty: number | null;
  item2_name: string | null;
  item2_qty: number | null;
  item3_name: string | null;
  item3_qty: number | null;
  status: 'available' | 'claimed' | 'not_posted' | 'inactive';
}

export default function GigsPage({ searchParams }: { searchParams?: { sort?: string } }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const navData = useNavData();
  const sortMode = searchParams?.sort || 'newest';

  useEffect(() => {
    if (!navData.fid) return;

    async function loadGigs() {
      try {
        const response = await fetch(`/api/gigs?fid=${navData.fid}&sort=${sortMode}`);
        if (!response.ok) throw new Error('Failed to fetch gigs');
        
        const data = await response.json();
        setGigs(data.gigs || []);
      } catch (err: any) {
        setError(err.message);
        console.error('Error loading gigs:', err);
      } finally {
        setLoading(false);
      }
    }

    loadGigs();
  }, [navData.fid, sortMode]);

  if (error) {
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load gigs</div>
          <div className="text-sm text-gray-300 mb-2">{error}</div>
        </div>
      </div>
    );
  }

  const isContactMode = sortMode.toLowerCase() === 'contact';

  return (
    <div className="frame-container frame-main">
      <NavDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
      />

      <div className="frame-body pt-6 pb-2 px-6">
        <NavStrip 
          username={navData.username}
          userProfileImage={navData.profileImage}
          cxBalance={navData.cxBalance}
          onMenuClick={() => setIsDrawerOpen(true)}
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

        {/* Loading state */}
        {loading && <div className="text-gray-400 p-4">Loading gigs...</div>}

        {/* Gigs list */}
        {!loading && !isContactMode && (
          <div className="space-y-2">
            {gigs.length === 0 && <div className="text-gray-400 p-4">No gigs available.</div>}
            {gigs.map((gig) => {
              const requirements = [];
              if (gig.item1_name) requirements.push(`${gig.item1_name} (${gig.item1_qty})`);
              if (gig.item2_name) requirements.push(`${gig.item2_name} (${gig.item2_qty})`);
              if (gig.item3_name) requirements.push(`${gig.item3_name} (${gig.item3_qty})`);

              const statusPill = 
                gig.status === 'claimed' ? { label: 'CLAIMED', className: 'bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full' } :
                gig.status === 'not_posted' ? { label: 'NOT POSTED', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' } :
                gig.status === 'inactive' ? { label: 'INACTIVE', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' } :
                { label: 'AVAILABLE', className: 'bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl' };

              return (
                <div key={gig.id}>
                  <CxCard className="cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-row items-start gap-4">
                        <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          {gig.posted_by_pfp ? (
                            <img src={gig.posted_by_pfp} alt={gig.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-600" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="meta-eyebrow">{gig.posted_by_display_name || gig.posted_by_username || 'Unknown'}</div>
                            <div className={statusPill.className}>{statusPill.label}</div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="card-title">{gig.title}</div>
                          </div>

                          <div className="mt-1 text-sm text-gray-400">{gig.description}</div>

                          {requirements.length > 0 && (
                            <div className="mt-1">
                              <span className="meta-heading text-sm">Requirements:</span>{' '}
                              <span className="text-gray-300">{requirements.join(', ')}</span>
                            </div>
                          )}

                          <div className="mt-1">
                            <span className="meta-heading text-sm">Reward:</span>{' '}
                            <span className="text-bright-green">{gig.reward} CX</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CxCard>
                </div>
              );
            })}
          </div>
        )}

        {/* Contact mode view */}
        {!loading && isContactMode && (
          <div className="space-y-2">
            {(() => {
              // Group by posted_by
              const groups = new Map<string, Gig[]>();
              for (const gig of gigs) {
                const key = gig.posted_by_username || 'unknown';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(gig);
              }

              return Array.from(groups.entries()).map(([username, items]) => {
                const first = items[0];
                return (
                  <div key={`group-${username}`}>
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <div className="w-6 h-6 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                        {first.posted_by_pfp ? (
                          <img src={first.posted_by_pfp} alt={username} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-600" />
                        )}
                      </div>
                      <div className="meta-heading text-sm">{first.posted_by_display_name || username}</div>
                    </div>

                    <div className="space-y-3">
                      {items.map((gig) => {
                        const requirements = [];
                        if (gig.item1_name) requirements.push(`${gig.item1_name} (${gig.item1_qty})`);
                        if (gig.item2_name) requirements.push(`${gig.item2_name} (${gig.item2_qty})`);
                        if (gig.item3_name) requirements.push(`${gig.item3_name} (${gig.item3_qty})`);

                        const statusPill = 
                          gig.status === 'claimed' ? { label: 'CLAIMED', className: 'bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full' } :
                          gig.status === 'not_posted' ? { label: 'NOT POSTED', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' } :
                          gig.status === 'inactive' ? { label: 'INACTIVE', className: 'bg-gray-500 text-gray-200 text-xs font-semibold px-2 py-0.5 rounded-full' } :
                          { label: 'AVAILABLE', className: 'bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl' };

                        return (
                          <div key={gig.id}>
                            <CxCard className="cursor-pointer hover:opacity-90 transition-opacity">
                              <div className="flex flex-col gap-4">
                                <div className="flex flex-row items-start gap-4">
                                  <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                                    {gig.posted_by_pfp ? (
                                      <img src={gig.posted_by_pfp} alt={gig.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-gray-600" />
                                    )}
                                  </div>

                                  <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="meta-eyebrow">{gig.posted_by_display_name || gig.posted_by_username || 'Unknown'}</div>
                                      <div className={statusPill.className}>{statusPill.label}</div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="card-title">{gig.title}</div>
                                    </div>

                                    <div className="mt-1 text-sm text-gray-400">{gig.description}</div>

                                    {requirements.length > 0 && (
                                      <div className="mt-1">
                                        <span className="meta-heading text-sm">Requirements:</span>{' '}
                                        <span className="text-gray-300">{requirements.join(', ')}</span>
                                      </div>
                                    )}

                                    <div className="mt-1">
                                      <span className="meta-heading text-sm">Reward:</span>{' '}
                                      <span className="text-bright-green">{gig.reward} CX</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CxCard>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
