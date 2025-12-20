'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { CxCard, NavStrip } from '../../../components/CxShared';
import NavDrawer from '../../../components/NavDrawer';
import CompactMeterStrip from '../../../components/CompactMeterStrip';
import { getMeterData } from '../../../lib/meterUtils';
import { useStats } from '../../../hooks/useStatsSWR';

interface MessageDetailClientProps {
  message: any;
  navData: any;
}

export default function MessageDetailClient({ message, navData }: MessageDetailClientProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { stats: userStats } = useStats(300187);

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
        <CompactMeterStrip meters={getMeterData(userStats || null)} />
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
          <a href="/messages" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">MESSAGE</div>
        </div>

        <div className="frame-body">
          {/* Contact info */}
          <div className="flex items-center gap-3 mb-4">
            <Link href={`/contacts/${message.contact_id}`}>
              <div className="w-16 h-16 bg-gray-700 rounded overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80">
                {message.contact_image_url ? (
                  <img src={message.contact_image_url} alt={message.contact_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
                    {message.contact_name.charAt(0)}
                  </div>
                )}
              </div>
            </Link>
            <div>
              <div className="meta-eyebrow">FROM</div>
              <Link href={`/contacts/${message.contact_id}`} className="card-title hover:text-bright-blue">
                {message.contact_name}
              </Link>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(message.received_at).toLocaleDateString()} {new Date(message.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Message content */}
          <CxCard>
            <div className="card-title mb-4">{message.subject}</div>
            <div className="text-gray-300 whitespace-pre-wrap">{message.body}</div>
          </CxCard>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Link href="/messages">
              <button className="btn-cx btn-cx-secondary">
                BACK TO MESSAGES
              </button>
            </Link>
            <Link href={`/messages?contact_id=${message.contact_id}`}>
              <button className="btn-cx btn-cx-secondary">
                ALL FROM {message.contact_name.toUpperCase()}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
