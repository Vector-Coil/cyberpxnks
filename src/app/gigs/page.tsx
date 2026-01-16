'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FrameHeader, NavStrip } from '../../components/CxShared';
import GigCard from '../../components/GigCard';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import { useNavData } from '../../hooks/useNavData';

interface Gig {
  id: number;
  title: string;
  description: string;
  reward_item?: number;
  reward_credits: number;
  contact: number;
  contact_name?: string;
  contact_image_url?: string;
  image_url?: string;
  req_1?: string;
  req_2?: string;
  req_3?: string;
  req_1_name?: string;
  req_2_name?: string;
  req_3_name?: string;
  status: string;
  last_completed_at?: string;
  completed_count: number;
  unlocked_at: string;
  objective?: string;
  requirements?: Array<{ text: string; met: boolean }>;
  objectives?: string[];
}

export default function GigsPage() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { userFid, isLoading: userLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 300187);
  const searchParams = useSearchParams();
  const sortMode = searchParams.get('sort') || 'newest';
  // Load gigs with simple retry/backoff to avoid transient API failures
  async function loadGigs() {
    setError('');
    setLoading(true);
    const maxAttempts = 3;
    let attempt = 1;
    const url = `/api/gigs?fid=${userFid}&sort=${sortMode}`;

    while (attempt <= maxAttempts) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch gigs (status ${response.status})`);
        const data = await response.json();
        setGigs(data.gigs || []);
        setError('');
        break;
      } catch (err: any) {
        console.error(`Gigs fetch attempt ${attempt} failed:`, err);
        if (attempt === maxAttempts) {
          setError(err?.message || 'Failed to fetch gigs');
        } else {
          // Exponential backoff
          await new Promise(res => setTimeout(res, 300 * attempt));
        }
      } finally {
        attempt++;
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (userLoading || !userFid) return;
    loadGigs();
  }, [userFid, userLoading, sortMode]);

  const handleRetry = () => {
    loadGigs();
  };

  if (error) {
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="p-6 bg-gray-900 rounded shadow-lg max-w-2xl text-center">
          <div className="text-lg font-bold text-red-400 mb-2">Failed to load gigs</div>
          <div className="text-sm text-gray-300 mb-4">{error}</div>
          <div className="flex items-center justify-center gap-3">
            <button
              className="btn-cx btn-cx-primary"
              onClick={handleRetry}
            >
              Retry
            </button>
            <a href="/dashboard" className="btn-cx btn-cx-secondary">Back</a>
          </div>
        </div>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="frame-container frame-main flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const isContactMode = sortMode.toLowerCase() === 'contact';

  return (
    <div className="frame-container frame-main">

      <div className="frame-body pt-6 pb-2 px-6">
        {(!userLoading && userFid) ? (
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            credits={navData.credits}
            cxBalance={navData.cxBalance}
          />
        ) : (
          <div className="w-full h-[34px]" />
        )}
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
              <a href="/gigs?sort=completed" className="meta-eyebrow hover:underline">Completed</a>
            </>
          ) : (
            <>
              <span className="pill-cloud-gray px-2 py-0.5">Newest</span>
              <a href="/gigs?sort=contact" className="meta-eyebrow hover:underline">Contact</a>
              <a href="/gigs?sort=completed" className="meta-eyebrow hover:underline">Completed</a>
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
              // Get resolved requirement names from API
              const requirements: string[] = [];
              if (gig.req_1_name) requirements.push(gig.req_1_name);
              if (gig.req_2_name) requirements.push(gig.req_2_name);
              if (gig.req_3_name) requirements.push(gig.req_3_name);

              // Check if gig is newly unlocked (within last 24 hours)
              const hoursSinceUnlock = (new Date().getTime() - new Date(gig.unlocked_at).getTime()) / (1000 * 60 * 60);
              const isNew = hoursSinceUnlock < 24;

              return (
                <div key={gig.id}>
                  <GigCard gig={gig} isNew={isNew} />
                </div>
              );
            })}
          </div>
        )}

        {/* Contact mode view */}
        {!loading && isContactMode && (
          <div className="space-y-2">
            {(() => {
              // Group by contact
              const groups = new Map<string, Gig[]>();
              for (const gig of gigs) {
                const key = gig.contact_name || 'Unknown Contact';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(gig);
              }

              return Array.from(groups.entries()).map(([contactName, items]) => {
                return (
                  <div key={`group-${contactName}`}>
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <div className="w-6 h-6 rounded overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                        {items[0]?.contact_image_url ? (
                          <img src={items[0].contact_image_url} alt={contactName} className="w-full h-full object-cover" />
                        ) : (
                          contactName.charAt(0)
                        )}
                      </div>
                      <div className="meta-heading text-sm">{contactName}</div>
                    </div>

                    <div className="space-y-3">
                      {items.map((gig) => {
                        // Get resolved requirement names from API
                        const requirements: string[] = [];
                        if (gig.req_1_name) requirements.push(gig.req_1_name);
                        if (gig.req_2_name) requirements.push(gig.req_2_name);
                        if (gig.req_3_name) requirements.push(gig.req_3_name);

                        // Check if gig is newly unlocked (within last 24 hours)
                        const hoursSinceUnlock = (new Date().getTime() - new Date(gig.unlocked_at).getTime()) / (1000 * 60 * 60);
                        const isNew = hoursSinceUnlock < 24;

                        return (
                          <div key={gig.id}>
                            <GigCard gig={gig} isNew={isNew} showDetails />
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
