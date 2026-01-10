'use client';
import React, { useState } from 'react';
import { NavStrip } from '../../../components/CxShared';
import { useAuthenticatedUser } from '../../../hooks/useAuthenticatedUser';

interface GigDetailClientProps {
  gigData: {
    id: number;
    gig_code: string;
    title: string;
    image_url: string | null;
    description: string;
    contact_id: number | null;
    contact_name: string;
    status: string | null;
    unlocked_at?: string | null;
    isNew: boolean;
    requirements: Array<{ text: string; met: boolean }>;
    objective?: string;
    objectives?: string[];
  };
  historyEvents: Array<{
    type: 'unlocked' | 'refreshed' | 'completed';
    date: string;
    gain?: string | null;
  }>;
  navData: {
    username: string;
    profileImage: string;
    credits: number;
    cxBalance: number;
  };
}

export default function GigDetailClient({ gigData, historyEvents, navData }: GigDetailClientProps) {
  const { userFid, isLoading: userLoading } = useAuthenticatedUser();
  const [requirementsState, setRequirementsState] = useState<Array<{ text: string; met: boolean }>>(gigData.requirements || []);
  const [validating, setValidating] = useState(false);

  // Poll validation for started gigs so UI updates if inventory changes
  React.useEffect(() => {
    let mounted = true;
    let timer: any = null;

    async function validateOnce() {
      if (!gigData || !gigData.id) return;
      const statusNorm = (gigData.status ?? '').toString().toUpperCase();
      if (!(statusNorm === 'STARTED' || statusNorm === 'IN PROGRESS')) return;
      if (!userFid) return;
      try {
        setValidating(true);
        const res = await fetch(`/api/gigs/${gigData.id}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userFid })
        });
        if (res.ok) {
          const json = await res.json();
          if (mounted && json && Array.isArray(json.requirements)) {
            setRequirementsState(json.requirements);
          }
        }
      } catch (err) {
        // ignore validation errors
      } finally {
        setValidating(false);
      }
    }

    // initial
    validateOnce();
    // poll while started
    timer = setInterval(() => validateOnce(), 5000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [gigData?.id, gigData?.status, userFid]);

  return (
    <>
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            credits={navData.credits}
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
              {gigData.image_url ? (
                <img src={gigData.image_url} alt={gigData.gig_code} className="w-full h-auto object-cover" />
              ) : (
                <div className="w-full h-64 bg-gray-600" />
              )}
            </div>

            <div className="flex flex-col">

              <div className="text-xl font-bold uppercase text-white mt-2 text-center relative">
                {gigData.gig_code}
                {gigData.isNew && (
                  <span className="pill pill-alert pill-alert-pulse absolute -top-2 right-0 z-10">NEW</span>
                )}
              </div>

              <div className="mt-4 mb-3 text-gray-300">{gigData.description}</div>


              <div className="mb-1">
                <span className="meta-heading">Objectives:</span>{' '}
                {gigData.objectives && gigData.objectives.length > 0 ? (
                  <div className="mt-1">
                    <ul className="list-disc ml-6">
                      {gigData.objectives.map((o, i) => (
                        <li key={i} className="text-blue-400">{o}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <span className="text-gray-400">No objectives</span>
                )}
              </div>

              <div className="mb-3">
                <span className="meta-heading">Contact:</span>{' '}
                <a href={`/contacts/${gigData.contact_id}`}>{gigData.contact_name}</a>
              </div>

              {/* Unlocked by (requirements) */}
              <div className="mb-3 mt-2">
                <span className="meta-heading">Unlocked by:</span>
                <div className="mt-1">
                  {requirementsState && requirementsState.length > 0 ? (
                    <ul className="list-disc ml-6">
                      {requirementsState.map((r, i) => (
                        <li key={i} className={r.met ? 'text-blue-400' : 'text-red-300'}>
                          {r.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-400">No unlock requirements</span>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="pb-4">

            <div className="mt-3">
              {/* CTA button */}
                {(() => {
                let statusNorm = (gigData.status ?? '').toString().toUpperCase();
                // Treat empty status as UNLOCKED when unlocked_at is present
                if (!statusNorm && gigData.unlocked_at) statusNorm = 'UNLOCKED';
                let btnLabel = 'BEGIN GIG';
                let isDisabled = false;
                let btnClass = 'btn-cx btn-cx-primary btn-cx-full';

                if (statusNorm === 'COMPLETED') {
                  btnLabel = 'COMPLETED';
                  isDisabled = true;
                  btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                } else if (statusNorm !== '' && statusNorm !== 'UNLOCKED' && statusNorm !== 'STARTED' && statusNorm !== 'IN PROGRESS') {
                  btnLabel = statusNorm === 'LOCKED' ? 'LOCKED' : 'UNAVAILABLE';
                  isDisabled = true;
                  btnClass = 'btn-cx btn-cx-disabled btn-cx-full';
                }

                // Determine if all requirements are met (client-side flag from server)
                const allRequirementsMet = Array.isArray(requirementsState) && requirementsState.length > 0 && requirementsState.every(r => r.met === true);

                // If a gig is started/in-progress but requirements are NOT met,
                // show a disabled 'IN PROGRESS' button rather than exposing the
                // start flow (which would fail) or the completion CTA.
                if ((statusNorm === 'STARTED' || statusNorm === 'IN PROGRESS') && !allRequirementsMet) {
                  return (<button className={'btn-cx btn-cx-disabled btn-cx-full'} disabled aria-disabled="true">IN PROGRESS</button>);
                }

                if ((statusNorm === 'STARTED' || statusNorm === 'IN PROGRESS') && allRequirementsMet) {
                  // Allow completion when in-progress and requirements met
                  btnLabel = 'COMPLETE';
                  isDisabled = false;
                  btnClass = 'btn-cx btn-cx-primary btn-cx-full';

                  const handleCompleteGig = async () => {
                    if (!userFid) { alert('Not authenticated'); return; }
                    try {
                      const res = await fetch(`/api/gigs/${gigData.id}/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userFid }),
                      });
                      if (res.ok) {
                        window.location.reload();
                      } else {
                        const err = await res.json().catch(() => null);
                        alert('Failed to complete gig' + (err?.error ? `: ${err.error}` : ''));
                      }
                    } catch (e) {
                      alert('Error completing gig');
                    }
                  };

                  return (<button className={btnClass} onClick={handleCompleteGig}>{btnLabel}</button>);
                }

                if (isDisabled) {
                  return (<button className={btnClass} disabled aria-disabled="true">{btnLabel}</button>);
                }

                // Start gig logic
                const handleStartGig = async () => {
                  if (!userFid) { alert('Not authenticated'); return; }
                  try {
                    const res = await fetch(`/api/gigs/${gigData.id}/start`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userFid }),
                    });
                    if (res.ok) {
                      window.location.reload();
                    } else {
                      alert('Failed to start gig');
                    }
                  } catch (e) {
                    alert('Error starting gig');
                  }
                };

                return (
                  <button className={btnClass} onClick={handleStartGig}>{btnLabel}</button>
                );
              })()}
            </div>

            {/* Gig History section */}
            <div className="card-dark mt-4">
              <h3 className="text-center meta-heading">Gig History</h3>

              <div className="mt-4 space-y-3">
                {historyEvents && historyEvents.length > 0 ? (
                  historyEvents.map((event, idx) => {
                    if (event.type === 'unlocked') {
                      return (
                        <div key={`u-${idx}`} className="flex items-center gap-3 text-gray-300">
                          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 17a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                            <path d="M17 8V7a5 5 0 10-10 0v1H5v11h14V8h-2zM9 7a3 3 0 116 0v1H9V7z" fill="currentColor"/>
                          </svg>
                          <div>Gig unlocked {new Date(event.date).toLocaleDateString('en-US')}</div>
                        </div>
                      );
                    }
                    if (event.type === 'refreshed') {
                      return (
                        <div key={`r-${idx}`} className="flex items-center gap-3 text-gray-300">
                          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 12a9 9 0 10-3.1 6.6L20 20v-5.1l-1.1.1A7 7 0 1119 12h2z" fill="currentColor"/>
                          </svg>
                          <div>Gig refresh {new Date(event.date).toLocaleDateString('en-US')}</div>
                        </div>
                      );
                    }
                    if (event.type === 'completed') {
                      return (
                        <div key={`c-${idx}`} className="flex items-center gap-3 text-gray-300">
                          <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div className="flex items-center gap-2">
                            <div>Completed {new Date(event.date).toLocaleDateString('en-US')}</div>
                            {event.gain ? <span className="pill-cloud-gray">{event.gain}</span> : null}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                ) : (
                  <div className="text-gray-400 text-center">No history</div>
                )}
              </div>

            </div>

          </div>

        </div>
      </div>
    </>
  );
}
