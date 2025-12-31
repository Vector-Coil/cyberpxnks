"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FrameHeader, CxCard, NavStrip } from '../../components/CxShared';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import type { NavData } from '../../types/common';
import { getMeterData } from '../../lib/meterUtils';

interface ContactItem {
  id: number;
  name: string;
  image_url?: string;
  unlocked_at?: string;
  gigs: number;
  messages: number;
  intel: number;
}

export default function ContactsPage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userFid || isAuthLoading) return;
    
    let mounted = true;
    async function load() {
      try {
        const [contactsRes, statsRes] = await Promise.all([
          fetch(`/api/contacts?fid=${userFid}`),
          fetch(`/api/stats?fid=${userFid}`)
        ]);
        
        if (!contactsRes.ok) {
          const txt = await contactsRes.text();
          throw new Error(`Failed to load contacts: ${contactsRes.status} ${txt}`);
        }
        const data: ContactItem[] = await contactsRes.json();
        if (mounted) setContacts(data);
        
        if (statsRes.ok) {
          const stats = await statsRes.json();
          if (mounted) setUserStats(stats);
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) setError(err.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [userFid, isAuthLoading]);

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
        <CompactMeterStrip meters={getMeterData(userStats)} />
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
          <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex  items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">CONTACTS</div>
        </div>
      <div className="frame-body">

        {loading && <div className="p-4 text-gray-400">Loading contacts...</div>}
        {error && <div className="p-4 text-red-400">{error}</div>}

        <div className="space-y-2">
          {contacts.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`} className="block">
              <CxCard className="cursor-pointer hover:shadow-lg">
                <div className="flex items-center gap-4">

                  <div className="w-16 h-16 bg-gray-700 overflow-hidden flex-shrink-0">
                    {c.image_url ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-600"></div>}
                  </div>

                  <div className="flex-1">

                    <div className="flex items-center justify-between">
                      <div className="card-title uppercase">{c.name?.toUpperCase()}</div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className={`px-2 py-0.5 text-xs rounded-full ${c.gigs > 0 ? 'bg-fuchsia-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{c.gigs} GIGS</div>
                      <div className={`px-2 py-0.5 text-xs font-bold rounded-full ${c.messages > 0 ? 'bg-bright-blue text-black' : 'bg-gray-600 text-gray-300'}`}>{c.messages} MESSAGES</div>
                      <div className={`px-2 py-0.5 text-xs rounded-full ${c.intel > 0 ? 'bg-lime-400 text-black' : 'bg-gray-600 text-gray-300'}`}>{c.intel} INTEL</div>
                    </div>

                  </div>

                </div>
              </CxCard>
            </Link>
          ))}
        </div>

      </div>
    </div>
    </>
  );
}
