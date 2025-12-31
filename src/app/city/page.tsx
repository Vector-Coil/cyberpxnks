"use client";
import React, { useState, useEffect } from 'react';
import { NavStrip, CxCard } from '../../components/CxShared';
import NavDrawer from '../../components/NavDrawer';
import LevelUpModal from '../../components/LevelUpModal';
import ConfirmModal from '../../components/ConfirmModal';
import CompactMeterStrip from '../../components/CompactMeterStrip';
import CollapsibleDistrictCard from '../../components/CollapsibleDistrictCard';
import { ActionResultsSummary } from '../../components/ActionResultsSummary';
import { DiscoveryCard, type Discovery } from '../../components/DiscoveryCard';
import { EncounterAlert, type Encounter } from '../../components/EncounterAlert';
import { ActionDismissButtons } from '../../components/ActionDismissButtons';
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
  discovery_time?: string;
}

interface District {
  id: number;
  name: string;
  description?: string;
  level: number;
  image_url?: string;
  zones: Zone[];
}

interface UserStats {
  current_consciousness: number;
  max_consciousness: number;
  current_stamina: number;
  current_bandwidth: number;
  level: number;
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
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  
  // Use countdown timer hook for active explore
  const { timeRemaining, isComplete } = useCountdownTimer(activeExplore?.end_time || null);

  // Calculate total zones discovered across all districts
  // Ensure districts array exists before reducing
  const totalZonesDiscovered = Array.isArray(districts) 
    ? districts.reduce((sum, district) => sum + (district.zones?.length || 0), 0) 
    : 0;

  // Handle expand/collapse all
  const handleToggleAll = () => {
    const newState = !allCollapsed;
    setAllCollapsed(newState);
    // Update localStorage for all districts
    districts.forEach(district => {
      localStorage.setItem(`district-collapse-${district.id}`, JSON.stringify(newState));
    });
    // Force re-render
    setRenderKey(prev => prev + 1);
  };

  useEffect(() => {
    async function loadData() {
      if (!userFid || isAuthLoading) return;
      
      try {
        // Parallelize all independent API calls for faster loading
        const [statsRes, districtsRes, exploreRes, historyRes, alertsRes, jobsRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/districts/with-zones?fid=${userFid}`),
          fetch(`/api/city/explore-status?fid=${userFid}`),
          fetch('/api/city/all-history'),
          fetch(`/api/alerts?fid=${userFid}`),
          fetch(`/api/active-jobs?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          console.log('Fetched user stats:', stats);
          setUserStats(stats);
          
          // Check if user leveled up
          if (stats.levelUp && stats.levelUp.leveledUp) {
            setNewLevel(stats.levelUp.newLevel);
            setShowLevelUpModal(true);
          }
        } else {
          console.error('Failed to fetch stats:', statsRes.status, await statsRes.text());
        }

        // Process districts with zones
        if (districtsRes.ok) {
          const districtsData = await districtsRes.json();
          console.log('Districts with zones:', districtsData);
          console.log('Total districts:', districtsData.length);
          
          // Ensure we have an array
          if (Array.isArray(districtsData)) {
            console.log('Total zones:', districtsData.reduce((sum: number, d: any) => sum + (d.zones?.length || 0), 0));
            setDistricts(districtsData);
          } else {
            console.error('Districts data is not an array:', districtsData);
            setDistricts([]);
          }
        } else {
          console.error('Failed to fetch districts:', districtsRes.status, await districtsRes.text());
          setDistricts([]);
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

        // Process user location
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          console.log('Alerts data received:', alertsData);
          if (alertsData.location?.zoneId) {
            setCurrentLocationId(alertsData.location.zoneId);
            console.log('Current location set:', alertsData.location);
          } else {
            console.warn('No location data in alerts response');
          }
        } else {
          console.error('Failed to fetch alerts:', alertsRes.status, await alertsRes.text());
        }

        // Process active jobs
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setActiveJobs(jobsData.jobs || []);
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
    
    // Reload districts with zones to show newly discovered content
    const [districtsRes, alertsRes] = await Promise.all([
      fetch(`/api/districts/with-zones?fid=${userFid}`),
      fetch(`/api/alerts?fid=${userFid}`)
    ]);

    if (districtsRes.ok) {
      const districtsData = await districtsRes.json();
      if (Array.isArray(districtsData)) {
        setDistricts(districtsData);
      } else {
        console.error('Districts reload data is not an array:', districtsData);
        setDistricts([]);
      }
    }

    if (alertsRes.ok) {
      const alertsData = await alertsRes.json();
      if (alertsData.location?.zoneId) {
        setCurrentLocationId(alertsData.location.zoneId);
      }
    }
    
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
            credits={navData.credits}
            cxBalance={navData.cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        <CompactMeterStrip meters={getMeterData(userStats)} />
        
        <div className="frame-body">
          {/* Explore CTA Button */}
          <div className="mb-6">
            <button 
              className={`btn-cx ${canExplore ? 'btn-cx-primary' : 'btn-cx-disabled'} w-full text-center`}
              onClick={handleExploreClick}
              disabled={!canExplore}
            >
              {activeExplore ? 'EXPLORATION IN PROGRESS' : 'EXPLORE THE CITY'}
            </button>
            {!canExplore && !activeExplore && userStats && (
              <p className="text-gray-400 text-sm mt-2 text-center">
                {userStats.current_consciousness < (userStats.max_consciousness * 0.5) && 'Consciousness too low. '}
                {userStats.current_bandwidth < 1 && 'Need at least 1 Bandwidth. '}
                {userStats.current_stamina < staminaCost && `Need ${staminaCost} Stamina.`}
              </p>
            )}
          </div>

          {/* City Map */}
          <div className="mb-6 city-map" style={{
            backgroundImage: 'url(https://vectorcoil.com/cx/images/city-map/City_-_Downsize.png)'
          }}>
          </div>

          {/* Active Explore Timer */}
          {activeExplore && !showResults && (
            <CxCard className="mb-6">
              <div className="text-center">
                {!isComplete ? (
                  <>
                    <h3 className="text-white font-bold uppercase mb-2">Exploring the City</h3>
                    <p className="text-gray-300 mb-4">{timeRemaining}</p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-fuschia h-2 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.max(0, Math.min(100, 
                            ((new Date().getTime() - new Date(activeExplore.timestamp).getTime()) / 
                            (new Date(activeExplore.end_time).getTime() - new Date(activeExplore.timestamp).getTime())) * 100
                          ))}%`
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-green-400 mb-4">Exploration Complete</p>
                    <button 
                      className="btn-cx btn-cx-primary"
                      onClick={handleViewResults}
                      disabled={isLoadingResults}
                    >
                      {isLoadingResults ? 'LOADING...' : 'VIEW RESULTS'}
                    </button>
                  </>
                )}
              </div>
            </CxCard>
          )}

          {/* Explore Results */}
          {showResults && exploreResults && (
            <div className="mb-6">
              <CxCard>
                <div className="text-center mb-4">
                  <h3 className="text-white font-bold uppercase mb-2">Results Summary</h3>
                </div>
                
                <ActionResultsSummary
                  actionName="Explore"
                  xpGained={exploreResults.xpGained || 0}
                  discovery={
                    exploreResults.discoveredZone ? {
                      type: 'zone' as const,
                      name: exploreResults.discoveredZone.name
                    } : exploreResults.discoveredItem ? {
                      type: 'item' as const,
                      name: exploreResults.discoveredItem.name
                    } : undefined
                  }
                />
                
                <div className="space-y-4 mt-4">
                  {exploreResults.discoveredZone && (
                    <DiscoveryCard
                      discovery={{
                        type: 'zone',
                        name: exploreResults.discoveredZone.name,
                        districtName: exploreResults.discoveredZone.districtName,
                        poiCount: exploreResults.discoveredZone.poiCount
                      }}
                    />
                  )}
                  
                  {exploreResults.discoveredItem && (
                    <DiscoveryCard
                      discovery={{
                        type: 'item',
                        name: exploreResults.discoveredItem.name,
                        rarity: exploreResults.discoveredItem.rarity,
                        itemType: exploreResults.discoveredItem.type
                      }}
                    />
                  )}
                  
                  {exploreResults.encounter && (
                    <EncounterAlert encounter={exploreResults.encounter} />
                  )}

                  <ActionDismissButtons
                    encounter={exploreResults.encounter}
                    onDismiss={handleBackFromResults}
                  />
                </div>
              </CxCard>
            </div>
          )}

          {/* Districts with Nested Zones Section */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-white font-bold uppercase text-lg mb-1">
              DISCOVERED ZONES ({totalZonesDiscovered})
            </h2>
            {districts.length > 0 && (
              <button
                onClick={handleToggleAll}
                className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold uppercase flex items-center gap-1 transition-colors"
              >
                {allCollapsed ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
                    EXPAND ALL
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_less</span>
                    COLLAPSE ALL
                  </>
                )}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
            </div>
          ) : districts.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              No zones explored yet.
            </div>
          ) : (
            <div className="space-y-0">
              {districts.map((district) => (
                <CollapsibleDistrictCard
                  key={`${district.id}-${renderKey}`}
                  district={district}
                  userLevel={userStats?.level || 1}
                  currentLocationId={currentLocationId}
                  activeJobs={activeJobs}
                  storageKey={`district-collapse-${district.id}`}
                />
              ))}
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
    </>
  );
}
