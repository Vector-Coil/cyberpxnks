"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../../components/CxShared';
import CompactMeterStrip from '../../../../components/CompactMeterStrip';
import { useNavData } from '../../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../../hooks/useAuthenticatedUser';
import { getMeterData } from '../../../../lib/meterUtils';

interface Protocol {
  id: number;
  name: string;
  controlling_alignment_id?: number;
  description: string;
  access_rep_id?: number;
  access_gig_id?: number;
  image_url?: string;
  subnet_id?: number;
  alignment_name?: string;
  subnet_name?: string;
}

interface ProtocolHistory {
  id: number;
  action_type: string;
  timestamp: string;
  end_time?: string;
  result_status: string;
  gains_data?: string;
  xp_data?: number;
}

interface UserStats {
  current_consciousness: number;
  max_consciousness: number;
  current_stamina: number;
  max_stamina: number;
  current_bandwidth: number;
  max_bandwidth: number;
  current_charge: number;
  max_charge: number;
}

export default function ProtocolDetailPage({ params }: { params: Promise<{ protocol: string }> }) {
  const router = useRouter();
  const [protocolId, setProtocolId] = useState<number | null>(null);
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  
  // Resolve params on mount
  useEffect(() => {
    params.then(({ protocol }) => {
      setProtocolId(parseInt(protocol, 10));
    });
  }, [params]);

  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [history, setHistory] = useState<ProtocolHistory[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyView, setHistoryView] = useState<'mine' | 'all'>('mine');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!protocolId || Number.isNaN(protocolId) || !userFid || isAuthLoading) return;

    async function loadData() {
      try {
        // Parallelize independent API calls
        const [statsRes, protocolRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/protocols/${protocolId}?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setUserStats(stats);
        }

        // Process protocol details
        if (protocolRes.ok) {
          const protocolData = await protocolRes.json();
          setProtocol(protocolData.protocol);
          setHistory(protocolData.history || []);
          setAllHistory(protocolData.allHistory || []);
        } else if (protocolRes.status === 403) {
          // User doesn't have access to this protocol
          router.push('/grid');
        }
      } catch (err) {
        console.error('Failed to load protocol data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [protocolId, userFid, isAuthLoading, router]);

  const handleBackToGrid = () => {
    router.push('/grid');
  };

  if (Number.isNaN(protocolId)) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body p-6">
          <div className="text-red-400">Invalid protocol ID</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <div className="frame-container frame-city">
          <div className="frame-body pt-6 pb-2 px-6">
            <NavStrip 
              username={navData.username}
              userProfileImage={navData.profileImage}
              credits={navData.credits}
              cxBalance={navData.cxBalance}
              onMenuClick={() => setIsDrawerOpen(true)}
            />
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
          </div>
        </div>
      </>
    );
  }

  if (!protocol) {
    return (
      <>

        <div className="frame-container frame-city">
          <div className="frame-body pt-6 pb-2 px-6">
            <NavStrip 
              username={navData.username}
              userProfileImage={navData.profileImage}
              credits={navData.credits}
              cxBalance={navData.cxBalance}
              onMenuClick={() => setIsDrawerOpen(true)}
            />
          </div>
          <div className="text-center text-gray-400 py-12">
            Protocol not found
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="frame-container frame-city">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            credits={navData.credits}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        <CompactMeterStrip meters={getMeterData(userStats)} />

        <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
          <button 
            onClick={handleBackToGrid}
            className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
          </button>
          <div className="masthead">PROTOCOL</div>
        </div>

        <div className="frame-body pt-0">
          {/* Protocol Hero Image */}
          <div className="w-full mb-6 overflow-hidden rounded relative">
            {protocol.image_url ? (
              <img src={protocol.image_url} alt={protocol.name} className="w-full h-auto object-cover" />
            ) : (
              <div className="w-full h-48 bg-gray-700" />
            )}
            {protocol.subnet_name && protocol.subnet_id && (
              <a 
                href={`/grid/subnet/${protocol.subnet_id}`} 
                className="absolute top-3 left-3 px-3 py-1 bg-cyan-500 text-black text-xs font-bold uppercase rounded hover:opacity-80 transition-opacity"
              >
                {protocol.subnet_name}
              </a>
            )}
          </div>

          {/* Protocol Info */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white uppercase mb-2">{protocol.name}</h1>
            <p className="text-gray-300 text-left">{protocol.description || 'No description available.'}</p>
          </div>

          {/* Actions Section - Conditional and Dynamic */}
          <div className="mb-12">
            <h2 className="text-white font-bold uppercase text-lg mb-3">ACTIONS</h2>
            <CxCard>
              <div className="text-center text-gray-400 text-sm py-4">
                Actions based on reputation and contacts will appear here
              </div>
            </CxCard>
          </div>

          {/* Protocol Activity */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold uppercase text-lg">PROTOCOL ACTIVITY</h2>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 text-xs font-semibold uppercase rounded ${
                    historyView === 'mine' 
                      ? 'bg-cyan-500 text-black' 
                      : 'bg-gray-700 text-gray-400'
                  }`}
                  onClick={() => setHistoryView('mine')}
                >
                  MY HISTORY
                </button>
                <button
                  className={`px-3 py-1 text-xs font-semibold uppercase rounded ${
                    historyView === 'all' 
                      ? 'bg-cyan-500 text-black' 
                      : 'bg-gray-700 text-gray-400'
                  }`}
                  onClick={() => setHistoryView('all')}
                >
                  ALL ACTIVITY
                </button>
              </div>
            </div>
            
            <CxCard>
              {historyView === 'mine' ? (
                // My History View
                history.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-4">
                    No activity in this protocol yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-gray-300 border-b border-gray-700 last:border-0 pb-3 last:pb-0">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 17a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                            <path d="M17 8V7a5 5 0 10-10 0v1H5v11h14V8h-2zM9 7a3 3 0 116 0v1H9V7z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-white font-semibold uppercase text-sm">
                              {entry.action_type || 'Action'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.timestamp).toLocaleDateString('en-US')}
                            </span>
                          </div>
                          {entry.gains_data && (
                            <div className="text-sm">
                              <span className="pill-cloud-gray text-xs">
                                {entry.gains_data}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // All Activity View
                allHistory.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-4">
                    No activity in this protocol yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-gray-300 border-b border-gray-700 last:border-0 pb-3 last:pb-0">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-300 mb-1">
                            {entry.message}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CxCard>
          </div>
        </div>
      </div>
    </>
  );
}