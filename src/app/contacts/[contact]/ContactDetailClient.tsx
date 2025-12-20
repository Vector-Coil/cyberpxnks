'use client';
import React, { useState } from 'react';
import { CxCard, NavStrip } from '../../../components/CxShared';
import NavDrawer from '../../../components/NavDrawer';

interface ContactDetailClientProps {
  contact: any;
  gigs: any[];
  navData: any;
}

export default function ContactDetailClient({ contact, gigs, navData }: ContactDetailClientProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <NavDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
      />
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
                            {g.image_url ? <img src={g.image_url} alt={g.gig_code} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                            </div>

                            <div className="flex-1">

                                <div className="flex items-center justify-between">
                                    <div className="card-title uppercase">{g.gig_code}</div>
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
                                let btnLabel = 'VIEW GIG';
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
    </>
  );
}
