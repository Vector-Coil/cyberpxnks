'use client';
import React, { useState } from 'react';
import { NavStrip } from '../../../components/CxShared';
import NavDrawer from '../../../components/NavDrawer';

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
    isNew: boolean;
    requirements: Array<{ text: string; met: boolean }>;
  };
  historyEvents: Array<{
    type: 'unlocked' | 'refreshed' | 'completed';
    date: string;
    gain?: string | null;
  }>;
  navData: {
    username: string;
    profileImage: string;
    cxBalance: number;
  };
}

export default function GigDetailClient({ gigData, historyEvents, navData }: GigDetailClientProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <NavDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} username={navData.username} cxBalance={navData.cxBalance} />
      
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
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

              <div className="text-xl font-bold uppercase text-white mt-2 text-center">
                {gigData.gig_code}
                {gigData.isNew && (
                  <span className="inline-block ml-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse">NEW</span>
                )}
              </div>

              <div className="mt-4 mb-3 text-gray-300">{gigData.description}</div>

              <div className="mb-1">
                <span className="meta-heading">Requirements:</span>{' '}
                {gigData.requirements && gigData.requirements.length > 0 ? (
                  <span>
                    {gigData.requirements.map((r, i) => (
                      <span key={i} className={r.met ? 'text-blue-400' : 'text-red-300'}>
                        {r.text}{i < gigData.requirements.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </div>

              <div className="mb-3">
                <span className="meta-heading">Contact:</span>{' '}
                <a href={`/contacts/${gigData.contact_id}`}>{gigData.contact_name}</a>
              </div>

            </div>
          </div>

          <div className="pb-4">

            <div className="mt-3">
              {/* CTA button */}
              {(() => {
                const statusNorm = (gigData.status ?? '').toString().toUpperCase();
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
                  <a href={`/gigs/${gigData.id}/play`}>
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
