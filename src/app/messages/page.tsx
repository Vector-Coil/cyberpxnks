"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FrameHeader, CxCard, NavStrip } from '../../components/CxShared';
import NavDrawer from '../../components/NavDrawer';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import { getMeterData } from '../../lib/meterUtils';
import { useStats } from '../../hooks/useStatsSWR';
import { getRelativeTime } from '../../lib/timeUtils';

interface Message {
  id: number;
  msg_code?: string;
  subject: string;
  body: string;
  contact_id?: number;
  contact_name?: string;
  contact_image_url?: string;
  message_image_url?: string;
  btn_1?: string;
  btn_2?: string;
  status: 'READ' | 'UNREAD';
  unlocked_at: string;
  read_at?: string;
}

export default function MessagesPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { userFid, isLoading: userLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 300187);
  const { stats: userStats } = useStats(userFid || 300187);
  const searchParams = useSearchParams();
  const sortMode = searchParams.get('sort') || 'newest';
  const contactFilter = searchParams.get('contact_id');

  useEffect(() => {
    if (userLoading || !userFid) return;

    async function loadMessages() {
      try {
        let url = `/api/messages?fid=${userFid}&sort=${sortMode}`;
        if (contactFilter) url += `&contact_id=${contactFilter}`;
        
        console.log('[Messages] Fetching from:', url);
        const response = await fetch(url);
        console.log('[Messages] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Messages] Error response:', errorText);
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[Messages] Received data:', data);
        setMessages(data.messages || []);
      } catch (err: any) {
        console.error('[Messages] Error loading messages:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [userFid, userLoading, sortMode, contactFilter]);

  const unreadCount = messages.filter(m => m.status === 'UNREAD').length;

  return (
    <>
      <NavDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
        userFid={userFid || undefined}
      />
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            credits={navData.credits}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        <CompactMeterStrip meters={getMeterData(userStats || null)} />
        <div className="pt-5 pb-2 px-6 flex flex-row gap-3">
          <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </a>
          <div className="masthead">MESSAGES</div>
          {unreadCount > 0 && (
            <div className="pill pill-alert">{unreadCount}</div>
          )}
        </div>

        <div className="frame-body">
          {/* Error banner at top if there's an issue */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Sort controls */}
          <div className="flex gap-2 mb-4">
            <Link href={`/messages?sort=newest${contactFilter ? `&contact_id=${contactFilter}` : ''}`}>
              <button className={`btn-cx ${sortMode === 'newest' ? 'btn-cx-primary' : 'btn-cx-secondary'}`}>
                NEWEST
              </button>
            </Link>
            <Link href={`/messages?sort=contact${contactFilter ? `&contact_id=${contactFilter}` : ''}`}>
              <button className={`btn-cx ${sortMode === 'contact' ? 'btn-cx-primary' : 'btn-cx-secondary'}`}>
                BY CONTACT
              </button>
            </Link>
            {contactFilter && (
              <Link href="/messages">
                <button className="btn-cx btn-cx-secondary">
                  SHOW ALL
                </button>
              </Link>
            )}
          </div>

          {loading && <div className="p-4 text-gray-400">Loading messages...</div>}

          {/* Message list */}
          {!loading && sortMode === 'newest' && (
            <div className="space-y-2">
              {messages.length === 0 && (
                <CxCard>
                  <div className="text-center text-gray-400 py-8">
                    <span className="material-symbols-outlined text-6xl mb-4 block">mail</span>
                    <div className="text-lg">No messages yet</div>
                    <div className="text-sm mt-2">Messages from contacts will appear here</div>
                  </div>
                </CxCard>
              )}
              {messages.map((msg) => (
                <Link key={msg.id} href={`/messages/${msg.id}`}>
                  <CxCard className="cursor-pointer hover:opacity-90 transition-opacity relative">
                    {msg.status === 'UNREAD' && (
                      <div className="absolute top-2 right-2 w-3 h-3 bg-bright-blue rounded-full" />
                    )}
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                        {msg.contact_image_url ? (
                          <img src={msg.contact_image_url} alt={msg.contact_name || 'Message'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                            {(msg.contact_name || 'M').charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="meta-eyebrow">{msg.contact_name || 'System Message'}</div>
                        <div className="card-title truncate">{msg.subject}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getRelativeTime(msg.unlocked_at)}
                        </div>
                      </div>
                    </div>
                  </CxCard>
                </Link>
              ))}
            </div>
          )}

          {/* Grouped by contact */}
          {!loading && sortMode === 'contact' && (() => {
            if (messages.length === 0) {
              return (
                <CxCard>
                  <div className="text-center text-gray-400 py-8">
                    <span className="material-symbols-outlined text-6xl mb-4 block">mail</span>
                    <div className="text-lg">No messages yet</div>
                    <div className="text-sm mt-2">Messages from contacts will appear here</div>
                  </div>
                </CxCard>
              );
            }

            const groups = new Map<string, Message[]>();
            for (const msg of messages) {
              const key = `${msg.contact_id}-${msg.contact_name}`;
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(msg);
            }

            return (
              <div className="space-y-4">
                {Array.from(groups.entries()).map(([key, msgs]) => {
                  const firstMsg = msgs[0];
                  const unreadInGroup = msgs.filter(m => m.status === 'UNREAD').length;
                  
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 flex-shrink-0">
                          {firstMsg.contact_image_url ? (
                            <img src={firstMsg.contact_image_url} alt={firstMsg.contact_name || 'Contact'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                              {(firstMsg.contact_name || 'C').charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="meta-heading text-sm">{firstMsg.contact_name}</div>
                        {unreadInGroup > 0 && (
                          <div className="pill pill-alert text-xs">{unreadInGroup}</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {msgs.map((msg) => (
                          <Link key={msg.id} href={`/messages/${msg.id}`}>
                            <CxCard className="cursor-pointer hover:opacity-90 transition-opacity relative">
                              {msg.status === 'UNREAD' && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-bright-blue rounded-full" />
                              )}
                              <div className="card-title">{msg.subject}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {getRelativeTime(msg.unlocked_at)}
                              </div>
                            </CxCard>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

