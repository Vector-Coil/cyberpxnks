"use client";
import React, { useState, useEffect } from 'react';
import { NavStrip, CxCard } from '../../components/CxShared';
import NavDrawer from '../../components/NavDrawer';
import LevelUpModal from '../../components/LevelUpModal';
import ConfirmModal from '../../components/ConfirmModal';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import { useNavData } from '../../hooks/useNavData';
import { useAuthenticatedUser } from '../../hooks/useAuthenticatedUser';
import { useCountdownTimer } from '../../hooks/useCountdownTimer';
import { getMeterData } from '../../lib/meterUtils';

interface Zone {
  id: number;
  name: string;
  zone_type: number;
  zone_type_name?: string;
  district_name?: string;
  description?: string;
  image_url?: string;
  shop_count?: number;
  terminal_count?: number;
}

interface District {
  id: number;
  name: string;
  description?: string;
}

interface UserStats {
  current_consciousness: number;
  max_consciousness: number;
  current_stamina: number;
  current_bandwidth: number;
}

interface ExploreAction {
  id: number;
  timestamp: string;
  end_time: string;
  result_status?: string;
}

export default function CityPage() {
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExploreModal, setShowExploreModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [exploreResults, setExploreResults] = useState<any>(null);
  const [activeExplore, setActiveExplore] = useState<ExploreAction | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [cityHistory, setCityHistory] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Use countdown timer hook for active explore
  const { timeRemaining, isComplete } = useCountdownTimer(activeExplore?.end_time || null);

  useEffect(() => {
    async function loadData() {
      if (!userFid || isAuthLoading) return;
      
      try {
        // Parallelize all independent API calls for faster loading
        const [statsRes, zonesRes, exploreRes, historyRes, districtsRes, alertsRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/zones?fid=${userFid}`),
          fetch(`/api/city/explore-status?fid=${userFid}`),
          fetch('/api/city/all-history'),
          fetch(`/api/districts?fid=${userFid}`),
          fetch(`/api/alerts?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          console.log('Fetched user stats:', stats);
          setUserStats(stats);
        } else {
          console.error('Failed to fetch stats:', statsRes.status, await statsRes.text());
        }

        // Process discovered zones
        if (zonesRes.ok) {
          const zonesData = await zonesRes.json();
          console.log('Zones data:', zonesData);
          setZones(zonesData);
        }

        // Process active explore action
        if (exploreRes.ok) {
          const exploreData = await exploreRes.json();
          if (exploreData.activeExplore) {
            setActiveExplore(exploreData.activeExplore);
          }
        }

        // Process city-wide activity history
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setCityHistory(historyData.history || []);
        }

        // Process districts
        if (districtsRes.ok) {
          const districtsData = await districtsRes.json();
          console.log('Districts data:', districtsData);
          setDistricts(districtsData);
        } else {
          console.error('Failed to fetch districts:', districtsRes.status, await districtsRes.text());
        }

        // Process user location
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (alertsData.location?.zoneId) {
            setCurrentLocationId(alertsData.location.zoneId);
            console.log('Current location:', alertsData.location);
          }
        }
      } catch (err) {
        console.error('Failed to load city data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userFid, isAuthLoading]);

  const staminaCost = 15;
  const canExplore = userStats && 
    userStats.current_consciousness >= (userStats.max_consciousness * 0.5) &&
    userStats.current_bandwidth >= 1 &&
    userStats.current_stamina >= staminaCost &&
    !activeExplore;

  // Debug logging
  console.log('Explore validation:', {
    userStats,
    canExplore,
    consciousnessCheck: userStats ? `${userStats.current_consciousness} >= ${userStats.max_consciousness * 0.5}` : 'no stats',
    bandwidthCheck: userStats ? `${userStats.current_bandwidth} >= 1` : 'no stats',
    staminaCheck: userStats ? `${userStats.current_stamina} >= ${staminaCost}` : 'no stats',
    activeExplore
  });

  const handleExploreClick = () => {
    if (canExplore) {
      setShowExploreModal(true);
    }
  };

  const handleConfirmExplore = async () => {
    if (isConfirming) return;
    
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/city/explore?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staminaCost })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveExplore(data.exploreAction);
        setUserStats(data.updatedStats);
        setShowExploreModal(false);
      }
    } catch (err) {
      console.error('Failed to start explore:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewResults = async () => {
    try {
      const res = await fetch(`/api/city/explore-results?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeExplore?.id })
      });

      if (res.ok) {
        const data = await res.json();
        setExploreResults(data);
        setShowResults(true);
        
        // Check for level up
        if (data.levelUp && data.levelUp.leveledUp) {
          setNewLevel(data.levelUp.newLevel);
          setShowLevelUpModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to get explore results:', err);
    }
  };

  const handleBackFromResults = async () => {
    // Dismiss the explore action
    if (exploreResults && exploreResults.historyId) {
      try {
        const dismissRes = await fetch('/api/city/dismiss-explore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid, historyId: exploreResults.historyId })
        });
        
        if (!dismissRes.ok) {
          console.error('Failed to dismiss explore');
        }
      } catch (err) {
        console.error('Failed to dismiss explore:', err);
      }
    }
    
    setShowResults(false);
    setExploreResults(null);
    setActiveExplore(null);
    
    // Reload zones to show newly discovered zone
    fetch(`/api/zones?fid=${userFid}`)
      .then(res => res.json())
      .then(zonesData => {
        setZones(zonesData);
      });
    
    // Reload history to show completed action
    fetch('/api/city/all-history')
      .then(res => res.json())
      .then(data => {
        setCityHistory(data.history || []);
      })
      .catch(err => console.error('Failed to reload history:', err));
  };

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
      <div className="frame-container frame-city">
        <div className="frame-body pt-6 pb-2 px-6">
          <NavStrip 
            username={navData.username}
            userProfileImage={navData.profileImage}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        <CompactMeterStrip meters={getMeterData(userStats)} />

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
        <a href="/dashboard" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">THE CITY</div>
      </div>

      <div className="frame-body">

        {/* City Map with Overlaid Explore Card */}
        <div className="relative mb-6">
          {/* City Map */}
          <div className="city-map" style={{
            backgroundImage: 'url(https://vectorcoil.com/cx/images/city-map/City_-_Downsize.png)'
          }}>
          </div>

          {/* Explore Card Overlay */}
          <div className="absolute top-5 left-5 right-5" style={{ opacity: 0.95 }}>
            <CxCard>
              {!showResults && !activeExplore && (
                <div className="flex flex-col justify-between">
                  <button 
                    className={`btn-cx btn-cx-primary ${!canExplore ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={handleExploreClick}
                    disabled={!canExplore}
                  >
                    EXPLORE
                  </button>
                  <div className="modal-body-data text-center mt-1">Go out into the city and discover new zones.</div>
                </div>
              )}

              {activeExplore && !showResults && (
                <div className="flex flex-col justify-between gap-1">
                  <button 
                    className={`btn-cx btn-cx-pause btn-cx-full mb-2 ${!isComplete || isLoadingResults ? 'cursor-default opacity-75' : ''}`}
                    onClick={handleViewResults}
                    disabled={!isComplete || isLoadingResults}
                  >
                    {isLoadingResults ? 'LOADING RESULTS...' : isComplete ? 'VIEW RESULTS' : 'EXPLORING IN PROGRESS'}
                  </button>
                  <div className="text-white text-center text-xs">{timeRemaining}</div>
                </div>
              )}

              {showResults && exploreResults && (
                <div>
                  <div className="modal-base mb-2">
                    <div className="modal-title mb-2">EXPLORE RESULTS</div>
                    <div className="modal-body-data space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Gained XP</span>
                        <span className="pill-cloud-gray">{exploreResults.xpGained} XP</span>
                      </div>
                      {exploreResults.discoveredZone && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Discovered Zone</span>
                          <span className="text-green-400 font-semibold">{exploreResults.discoveredZone.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {exploreResults.encounter && (
                    <div className="modal-base mb-2 border-2 border-yellow-500/50">
                      <div className="modal-title mb-2 text-yellow-400">⚠ ENCOUNTER DETECTED</div>
                      <div className="modal-body-data space-y-2">
                        <div className="text-gray-300 text-sm">
                          You've encountered <span className="text-white font-semibold">{exploreResults.encounter.name}</span>, 
                          a <span className="text-cyan-400">{exploreResults.encounter.type}</span> with {' '}
                          <span className={`font-semibold ${
                            exploreResults.encounter.sentiment === 'attack' ? 'text-red-500' :
                            exploreResults.encounter.sentiment === 'hostile' ? 'text-orange-500' :
                            exploreResults.encounter.sentiment === 'neutral' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>{exploreResults.encounter.sentiment}</span> intentions.
                        </div>
                      </div>
                    </div>
                  )}

                  {exploreResults.encounter ? (
                    <div className="space-y-2">
                      <button 
                        className="btn-cx btn-cx-primary btn-cx-full"
                        onClick={() => window.location.href = `/encounters/${exploreResults.encounter.id}`}
                      >
                        OPEN ENCOUNTER
                      </button>
                      <button 
                        className="btn-cx btn-cx-secondary btn-cx-full"
                        onClick={handleBackFromResults}
                      >
                        RUN AWAY (DISMISS)
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn-cx btn-cx-secondary btn-cx-full"
                      onClick={handleBackFromResults}
                    >
                      DISMISS
                    </button>
                  )}
                </div>
              )}
            </CxCard>
          </div>
        </div>

        {/* Districts Section */}
        {districts.length > 0 && (
          <>
            <div className="mb-4">
              <h2 className="text-white font-bold uppercase text-lg mb-1">DISTRICTS</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {districts.map((district) => (
                <a
                  key={district.id}
                  href={`/city/district/${district.id}`}
                  className="btn-cx btn-cx-primary text-center"
                >
                  {district.name}
                </a>
              ))}
            </div>
          </>
        )}

        {/* Zones Section */}
        <div className="mb-4">
          <h2 className="text-white font-bold uppercase text-lg mb-1">DISCOVERED ZONES ({zones.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
          </div>
        ) : zones.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No zones explored yet.
          </div>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => {
              const isCurrentLocation = zone.id === currentLocationId;
              return (
                <a 
                  key={zone.id} 
                  href={`/city/${zone.id}`} 
                  className="block"
                >
                  <div 
                    className={`cx-banner ${isCurrentLocation ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/50' : ''}`}
                    style={zone.image_url ? { 
                      backgroundImage: `url(${zone.image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    } : undefined}
                  >
                    <div className="banner-left flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {zone.district_name && (
                            <span className="px-2 py-1 bg-fuschia text-white text-xs font-bold uppercase rounded flex-shrink-0">
                              {zone.district_name}
                            </span>
                          )}
                          {isCurrentLocation && (
                            <span className="px-2 py-1 bg-cyan-400 text-black text-xs font-bold uppercase rounded flex-shrink-0">
                              CURRENT LOCATION
                            </span>
                          )}
                        </div>
                        <span className="pill-cloud-gray uppercase flex-shrink-0">{zone.zone_type_name || zone.zone_type}</span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="text-white font-bold uppercase text-lg flex items-center gap-2">
                          {isCurrentLocation && (
                            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>location_on</span>
                          )}
                          {zone.name}
                        </div>
                        {/* POI Indicators */}
                        {((zone.terminal_count || 0) > 0 || (zone.shop_count || 0) > 0) && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {(zone.terminal_count || 0) > 0 && (
                              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 rounded text-xs">
                                <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '14px' }}>terminal</span>
                                <span className="text-cyan-400 font-semibold">{zone.terminal_count}</span>
                              </div>
                            )}
                            {(zone.shop_count || 0) > 0 && (
                              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 rounded text-xs">
                                <span className="material-symbols-outlined text-green-400" style={{ fontSize: '14px' }}>storefront</span>
                                <span className="text-green-400 font-semibold">{zone.shop_count}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* City-wide Activity */}
        <div className="mt-8 mb-4">
          <h2 className="text-white font-bold uppercase text-lg mb-3">CITY ACTIVITY</h2>
        </div>

        <CxCard>
          {cityHistory.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No activity in the city yet.
            </div>
          ) : (
            <div className="space-y-3">
              {cityHistory.map((entry) => {
                // Parse message to make zone name clickable
                let messageContent = entry.message;
                
                // Replace zone name with link if present
                if (entry.zone_name && entry.zone_id) {
                  const zoneLinkRegex = new RegExp(`(at )(${entry.zone_name})`, 'g');
                  const parts = messageContent.split(zoneLinkRegex);
                  
                  return (
                    <div key={entry.id} className="flex items-start gap-3 text-gray-300 border-b border-gray-700 last:border-0 pb-3 last:pb-0">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-gray-300 mb-1">
                          {parts.map((part: string, idx: number) => {
                            if (part === entry.zone_name && idx > 0 && parts[idx - 1] === 'at ') {
                              return (
                                <a 
                                  key={idx}
                                  href={`/city/${entry.zone_id}`}
                                  className="text-fuschia hover:text-cyan-400 underline"
                                >
                                  {part}
                                </a>
                              );
                            }
                            return <span key={idx}>{part}</span>;
                          })}
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
                  );
                }
                
                // Default rendering without zone link
                return (
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
                );
              })}
            </div>
          )}
        </CxCard>

      </div>

      {/* Explore Confirmation Modal */}
      <ConfirmModal
        isOpen={showExploreModal}
        title="Explore the city?"
        description="Discover new zones throughout the various districts."
        costInfo={[`Cost: ${staminaCost} Stamina, 1 Bandwidth`]}
        durationInfo="Duration: 3 hours"
        onCancel={() => setShowExploreModal(false)}
        onConfirm={handleConfirmExplore}
        isConfirming={isConfirming}
      />

      {/* Level Up Modal */}
      <LevelUpModal 
        isOpen={showLevelUpModal} 
        newLevel={newLevel} 
        onDismiss={() => setShowLevelUpModal(false)} 
      />
    </div>
    </>
  );
}
