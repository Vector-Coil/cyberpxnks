"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../../components/CxShared';
import CompactMeterStrip from '../../../../components/CompactMeterStrip';
import { useNavData } from '../../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../../hooks/useAuthenticatedUser';
import { getMeterData } from '../../../../lib/meterUtils';

interface Subnet {
  id: number;
  name: string;
  description: string;
  image_url?: string;
}

interface Terminal {
  id: number;
  name: string;
  zone_id: number;
  zone_name: string;
  poi_type: string;
  type_label?: string;
  description: string;
  image_url?: string;
  unlocked_at: string;
}

interface Protocol {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  subnet_name?: string;
  unlocked_at: string;
}

interface SubnetHistory {
  id: number;
  action_type: string;
  timestamp: string;
  end_time?: string;
  result_status: string;
  gains_data?: string;
  xp_data?: number;
  poi_name: string;
  poi_id: number;
  zone_name: string;
  zone_id: number;
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

export default function SubnetDetailPage({ params }: { params: Promise<{ subnet: string }> }) {
  const router = useRouter();
  const [subnetId, setSubnetId] = useState<number | null>(null);
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  
  // Resolve params on mount
  useEffect(() => {
    params.then(({ subnet }) => {
      setSubnetId(parseInt(subnet, 10));
    });
  }, [params]);

  const [subnet, setSubnet] = useState<Subnet | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [history, setHistory] = useState<SubnetHistory[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyView, setHistoryView] = useState<'mine' | 'all'>('mine');

  useEffect(() => {
    if (!subnetId || Number.isNaN(subnetId) || !userFid || isAuthLoading) return;

    async function loadData() {
      try {
        // Parallelize independent API calls
        const [statsRes, subnetRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/subnets/${subnetId}?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setUserStats(stats);
        }

        // Process subnet details
        if (subnetRes.ok) {
          const subnetData = await subnetRes.json();
          setSubnet(subnetData.subnet);
          setTerminals(subnetData.terminals || []);
          setProtocols(subnetData.protocols || []);
          setHistory(subnetData.history || []);
          setAllHistory(subnetData.allHistory || []);
        } else if (subnetRes.status === 403) {
          // User doesn't have access to this subnet
          router.push('/grid');
        }
      } catch (err) {
        console.error('Failed to load subnet data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [subnetId, userFid, isAuthLoading, router]);

  const handleBackToGrid = () => {
    router.push('/grid');
  };

  if (Number.isNaN(subnetId)) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body p-6">
          <div className="text-red-400">Invalid subnet ID</div>
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
            />
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
          </div>
        </div>
      </>
    );
  }

  if (!subnet) {
    return (
      <>
        <div className="frame-container frame-city">
          <div className="frame-body pt-6 pb-2 px-6">
            <NavStrip 
              username={navData.username}
              userProfileImage={navData.profileImage}
              credits={navData.credits}
              cxBalance={navData.cxBalance}
            />
          </div>
          <div className="text-center text-gray-400 py-12">
            Subnet not found
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
          <div className="masthead">SUBNET</div>
        </div>

        <div className="frame-body pt-0">
          {/* Subnet Hero Image */}
          <div className="w-full mb-6 overflow-hidden rounded relative">
            {subnet.image_url ? (
              <img src={subnet.image_url} alt={subnet.name} className="w-full h-auto object-cover" />
            ) : (
              <div className="w-full h-48 bg-gray-700" />
            )}
          </div>

          {/* Subnet Info */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white uppercase mb-2">{subnet.name}</h1>
            <p className="text-gray-300 text-left">{subnet.description || 'No description available.'}</p>
          </div>

          {/* Unlocked Terminals/Access Points */}
          <div className="mb-12">
            <h2 className="text-white font-bold uppercase text-lg mb-3">ACCESS POINTS</h2>
            {terminals.length === 0 ? (
              <CxCard>
                <div className="text-center text-gray-400 text-sm py-4">
                  Scout zones and run Overnet Scans to discover access points connected to this subnet.
                </div>
              </CxCard>
            ) : (
              <div className="space-y-3">
                {terminals.map((terminal) => (
                  <CxCard key={terminal.id} href={`/city/${terminal.zone_id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-white font-bold uppercase text-base mb-1">
                          {terminal.name}
                        </h3>
                        <div className="text-gray-400 text-sm mb-2">
                          {terminal.description}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="pill-cloud-gray text-xs">
                            {terminal.type_label || terminal.poi_type}
                          </span>
                          <span className="text-gray-500 text-xs">in {terminal.zone_name}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                      </div>
                    </div>
                  </CxCard>
                ))}
              </div>
            )}
          </div>

          {/* Protocols Section */}
          <div className="mb-12">
            <h2 className="text-white font-bold uppercase text-lg mb-3">PROTOCOLS</h2>
            {protocols.length === 0 ? (
              <CxCard>
                <div className="text-center text-gray-400 text-sm py-4">
                  Complete gigs and unlock protocols related to this subnet.
                </div>
              </CxCard>
            ) : (
              <div className="space-y-3">
                {protocols.map((protocol) => (
                  <CxCard key={protocol.id} href={`/grid/protocol/${protocol.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-white font-bold uppercase text-base mb-1">
                          {protocol.name}
                        </h3>
                        {protocol.description && (
                          <div className="text-gray-400 text-sm">
                            {protocol.description}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                      </div>
                    </div>
                  </CxCard>
                ))}
              </div>
            )}
          </div>

          {/* Subnet Activity */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-bold uppercase text-lg">SUBNET ACTIVITY</h2>
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
                    No activity in this subnet yet.
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
                              {entry.action_type === 'UnlockedPOI' ? 'DISCOVERED' : entry.action_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.timestamp).toLocaleDateString('en-US')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-300 mb-1">
                            {entry.poi_name} in {entry.zone_name}
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
                    No activity in this subnet yet.
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