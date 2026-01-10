'use client';
import React, { useState } from 'react';
import { NavStrip } from '../../../components/CxShared';
import GigCard from '../../../components/GigCard';

interface ContactDetailClientProps {
  contact: any;
  gigs: any[];
  navData: any;
  messageInfo: { total: number; unread: number };
  userFid: number;
}

export default function ContactDetailClient({ contact, gigs, navData, messageInfo, userFid }: ContactDetailClientProps) {

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
          <a href="/contacts" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">CONTACTS</div>
        </div>
        <div className="frame-body">

          {/* Top section outside of cards */}
          <div className="flex direction-row gap-3 mb-6">
            
            <div className="direction-column gap-3">
              <div className="w-28 h-28overflow-hidden flex-shrink-0">
                {contact.image_url ? <img src={contact.image_url} alt={contact.name} className="w-full h-full object-cover" /> : null}
              </div>
              
              {/* Messages section */}              
              {messageInfo.total > 0 ? (
                <a href={`/messages?contact_id=${contact.id}`} className="inline-block">
                  <button className="btn-cx btn-cx-full btn-cx-secondary text-xs flex items-center gap-2">
                    MESSAGES
                    {messageInfo.unread > 0 && (
                      <span className="pill pill-alert text-xs">{messageInfo.unread}</span>
                    )}
                  </button>
                </a>
              ) : (
                <div className="text-sm text-gray-500">No Messages</div>
              )}
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
                  <div className="flex flex-row items-start gap-4">
                    <div className="w-20 h-20 bg-gray-700 rounded overflow-hidden flex-shrink-0 relative">
                      {g.image_url ? <img src={g.image_url} alt={g.gig_code} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600" />}
                      {gigs.map(g => (
                        <div key={g.id}>
                          <GigCard gig={g} isNew={((new Date().getTime() - new Date(g.unlocked_at).getTime()) / (1000 * 60 * 60)) < 24} />
                        </div>
                      ))}
                        <div className="card-title uppercase relative">
                          {g.gig_code}
                          {/* NEW pill for recently unlocked gigs */}
                          {(() => {
                            const hoursSinceUnlock = (new Date().getTime() - new Date(g.unlocked_at).getTime()) / (1000 * 60 * 60);
                            const isNew = hoursSinceUnlock < 24;
                            return isNew ? (
                              <span className="pill pill-alert pill-alert-pulse absolute -top-2 right-0 z-10">NEW</span>
                            ) : null;
                          })()}
                        </div>
                        <div className="mt-1 text-gray-300">{g.description}</div>
                      </div>
                      <div className="mt-3">
                        <a href={`/gigs/${g.id}`} className="inline-block w-full">
                          <button className="btn-cx btn-cx-primary btn-cx-full">VIEW GIG</button>
                        </a>
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
