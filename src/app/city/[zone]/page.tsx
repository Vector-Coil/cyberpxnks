"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../components/CxShared';
import LevelUpModal from '../../../components/LevelUpModal';
import ConfirmModal from '../../../components/ConfirmModal';
import NavDrawer from '../../../components/NavDrawer';
import PoiCard from '../../../components/PoiCard';
import CompactMeterStrip from '../../../components/CompactMeterStrip';
import { ActionResultsSummary } from '../../../components/ActionResultsSummary';
import { DiscoveryCard } from '../../../components/DiscoveryCard';
import { EncounterAlert } from '../../../components/EncounterAlert';
import { ActionDismissButtons } from '../../../components/ActionDismissButtons';
import { useNavData } from '../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../hooks/useAuthenticatedUser';
import { useCountdownTimer } from '../../../hooks/useCountdownTimer';
import { getMeterData } from '../../../lib/meterUtils';

interface Zone {
  id: number;
  name: string;
  zone_type: number;
  zone_type_name?: string;
  district?: number;
  district_name?: string;
  district_map_url?: string;
  description: string;
  image_url?: string;
}

interface ZoneHistory {
  id: number;
  action_type: string;
  timestamp: string;
  end_time?: string;
  result_status: string;
  gains_data?: string;
  xp_data?: number;
  poi_id?: number;
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

interface POI {
  id: number;
  zone_id: number;
  name: string;
  poi_type: string;
  subnet_id: number;
  description: string;
  breach_difficulty: number;
  image_url?: string;
  unlocked_at: string;
  unlock_method: string;
  type_label?: string;
}

export default function ZoneDetailPage({ params }: { params: Promise<{ zone: string }> }) {
  const router = useRouter();
  const [zoneId, setZoneId] = useState<number | null>(null);
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);
  
  // Resolve params on mount
  useEffect(() => {
    params.then(({ zone }) => {
      setZoneId(parseInt(zone, 10));
    });
  }, [params]);

  const [zone, setZone] = useState<Zone | null>(null);
  const [history, setHistory] = useState<ZoneHistory[]>([]);
  const [poi, setPoi] = useState<POI[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [showScoutModal, setShowScoutModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [scoutResults, setScoutResults] = useState<any>(null);
  const [activeScout, setActiveScout] = useState<ZoneHistory | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  
  // Use countdown timer hook for scout action
  const { timeRemaining, isComplete: isScoutComplete } = useCountdownTimer(activeScout?.end_time || null);
  
  // Breach-related state
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [breachSuccessRate, setBreachSuccessRate] = useState<any>(null);
  const [activeBreaches, setActiveBreaches] = useState<Map<number, any>>(new Map());
  const [breachTimeRemaining, setBreachTimeRemaining] = useState<Map<number, string>>(new Map());
  const [isBreachConfirming, setIsBreachConfirming] = useState(false);
  const [showBreachResults, setShowBreachResults] = useState(false);
  const [breachResults, setBreachResults] = useState<any>(null);
  
  // History toggle state
  const [historyView, setHistoryView] = useState<'mine' | 'all'>('mine');
  const [allHistory, setAllHistory] = useState<any[]>([]);
  
  // Travel/Location state
  const [userLocation, setUserLocation] = useState<number | null>(null);
  const [showTravelModal, setShowTravelModal] = useState(false);
  const [isTraveling, setIsTraveling] = useState(false);
  
  // Zone action effects from equipped slimsoft
  const [zoneActions, setZoneActions] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!zoneId || Number.isNaN(zoneId) || !userFid || isAuthLoading) return;

    async function loadData() {
      try {
        // Parallelize independent API calls for faster loading
        const [statsRes, zoneRes, effectsRes, hardwareRes] = await Promise.all([
          fetch(`/api/stats?fid=${userFid}`),
          fetch(`/api/zones/${zoneId}?fid=${userFid}`),
          fetch(`/api/slimsoft/effects?fid=${userFid}`),
          fetch(`/api/hardware?fid=${userFid}`)
        ]);

        // Process user stats
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setUserStats(stats);
          // Extract level if it exists in stats response
          if (stats.level) {
            setUserLevel(stats.level);
          }
          
          // Check if user leveled up
          if (stats.levelUp && stats.levelUp.leveledUp) {
            setNewLevel(stats.levelUp.newLevel);
            setShowLevelUpModal(true);
          }
        }

        // Process hardware data to get equipped slimsoft item IDs
        let equippedItemIds: number[] = [];
        if (hardwareRes.ok) {
          const hardwareData = await hardwareRes.json();
          if (hardwareData.slimsoft) {
            equippedItemIds = hardwareData.slimsoft
              .filter((s: any) => s.is_equipped === 1)
              .map((s: any) => s.id);
          }
        }

        // Process slimsoft effects for zone actions
        if (effectsRes.ok) {
          const effectsData = await effectsRes.json();
          if (effectsData.effects) {
            // Filter for action effects available in zones from equipped slimsoft
            const actions = effectsData.effects.filter((e: any) => {
              // Check if this slimsoft is equipped
              if (!equippedItemIds.includes(e.item_id)) return false;
              
              // Check if it's an action type
              if (e.effect_type !== 'action') return false;
              
              // Check if available_at includes 'zone' (handle comma-separated values)
              if (!e.available_at) return false;
              const locations = e.available_at.split(',').map((loc: string) => loc.trim().toLowerCase());
              return locations.includes('zone');
            });
            setZoneActions(actions);
          }
        }

        // Process zone details
        if (zoneRes.ok) {
          const zoneData = await zoneRes.json();
          setZone(zoneData.zone);
          setHistory(zoneData.history || []);
          setPoi(zoneData.poi || []);
          setUserLocation(zoneData.userLocation);
          
          // Check for active scout action
          // Only show as active if in progress (no result_status)
          // Exclude completed/dismissed scouts
          const now = new Date().getTime();
          const activeScout = zoneData.history.find((h: ZoneHistory) => {
            if (h.action_type !== 'Scouted' || !h.end_time) return false;
            // Only include scouts with NO result_status (truly in progress or ready for results)
            if (h.result_status) return false;
            const endTime = new Date(h.end_time).getTime();
            // Include both in-progress and completed-but-not-viewed
            return true;
          });
          if (activeScout) {
            setActiveScout(activeScout);
          }

          // Check for active breaches for each POI in this zone
          if (zoneData.poi && zoneData.poi.length > 0) {
            const newActiveBreaches = new Map<number, any>();
            
            // Check history for active breaches in this zone (both physical and remote)
            // Only include breaches that are truly in progress (no result_status)
            // Exclude:
            // - 'completed': Already processed, results viewed
            // - 'dismissed': User dismissed the action
            const activeZoneBreaches = zoneData.history.filter((h: any) => {
              if (!(h.action_type === 'Breached' || h.action_type === 'RemoteBreach')) return false;
              if (!h.end_time || !h.poi_id) return false; // Must have end_time and POI
              // Only include breaches with NO result_status (in progress or ready for results)
              return !h.result_status || h.result_status === '';
            });
            
            // Map breaches to their POI IDs
            for (const breach of activeZoneBreaches) {
              newActiveBreaches.set(breach.poi_id, {
                id: breach.id,
                poi_id: breach.poi_id,
                end_time: breach.end_time,
                timestamp: breach.timestamp
              });
            }
            
            if (newActiveBreaches.size > 0) {
              console.log('Set active breaches for zone:', newActiveBreaches);
              setActiveBreaches(newActiveBreaches);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load zone data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [zoneId, userFid, isAuthLoading]);

  const handleLeaveZone = () => {
    router.push('/city');
  };

  // Check for any physical actions in progress at current location
  // Physical actions (Scout, Breach, Explore, etc) block travel and other physical actions
  const hasPhysicalActionInProgress = history.some(h => {
    // Physical action types that require user to be at the location
    const physicalActionTypes = ['Scouted', 'Breached', 'RemoteBreach', 'OvernetScan', 'Exploring'];
    
    // Check if this is a physical action type
    if (!physicalActionTypes.includes(h.action_type)) return false;
    
    // Check if it has an end time
    if (!h.end_time) return false;
    
    // Check if it's still in progress (matches backend logic)
    const isInProgress = !h.result_status || h.result_status === '' || h.result_status === 'in_progress';
    if (!isInProgress) return false;
    
    // Check if end time hasn't passed yet
    return new Date(h.end_time).getTime() > Date.now();
  });

  const staminaCost = 10;
  const canScout = userStats && 
    userStats.current_consciousness >= (userStats.max_consciousness * 0.5) &&
    userStats.current_bandwidth >= 1 &&
    userStats.current_stamina >= staminaCost &&
    !hasPhysicalActionInProgress;

  const handleScoutClick = () => {
    if (canScout) {
      setShowScoutModal(true);
    }
  };

  const handleConfirmScout = async () => {
    if (isConfirming) return; // Prevent double-click
    
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/zones/scout?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId, staminaCost })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveScout(data.scoutAction);
        setUserStats(data.updatedStats);
        setShowScoutModal(false);
        
        // Reload zone data to update history
        const zoneRes = await fetch(`/api/zones/${zoneId}?fid=${userFid}`);
        if (zoneRes.ok) {
          const zoneData = await zoneRes.json();
          setHistory(zoneData.history || []);
        }
      } else {
        const errorData = await res.json();
        console.error('Scout failed:', errorData.error);
        alert(errorData.error || 'Failed to start scout');
      }
    } catch (err) {
      console.error('Failed to start scout:', err);
      alert('Failed to start scout');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewResults = async () => {
    try {
      const res = await fetch(`/api/zones/scout-results?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeScout?.id })
      });

      if (res.ok) {
        const data = await res.json();
        setScoutResults(data);
        setShowResults(true);
        setActiveScout(null);
        
        // Update user stats
        if (data.updatedStats) {
          setUserStats(data.updatedStats);
        }
        
        // Check for level up
        if (data.levelUp && data.levelUp.leveledUp) {
          setNewLevel(data.levelUp.newLevel);
          setShowLevelUpModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to get scout results:', err);
    }
  };

  const handleBackFromResults = async () => {
    // Dismiss the scout action
    if (scoutResults && scoutResults.historyId) {
      try {
        const dismissRes = await fetch('/api/zones/dismiss-scout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid, historyId: scoutResults.historyId })
        });
        
        if (!dismissRes.ok) {
          console.error('Failed to dismiss scout');
        }
      } catch (err) {
        console.error('Failed to dismiss scout:', err);
      }
    }
    
    setScoutResults(null);
    
    // Reload zone data to refresh history and newly discovered POIs
    try {
      const zoneRes = await fetch(`/api/zones/${zoneId}?fid=${userFid}`);
      if (zoneRes.ok) {
        const zoneData = await zoneRes.json();
        setHistory(zoneData.history || []);
        setPoi(zoneData.poi || []);
      }
    } catch (err) {
      console.error('Failed to reload zone data:', err);
    }
  };

  // Breach handlers
  const handleBreachClick = (poiItem: POI) => {
    setSelectedPoi(poiItem);
    setShowBreachModal(true);
  };

  const handleConfirmBreach = async () => {
    if (isBreachConfirming || !selectedPoi) return;
    
    setIsBreachConfirming(true);
    try {
      const res = await fetch(`/api/zones/breach?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poiId: selectedPoi.id, zoneId })
      });

      if (res.ok) {
        const data = await res.json();
        const newActiveBreaches = new Map(activeBreaches);
        newActiveBreaches.set(selectedPoi.id, data.breachAction);
        setActiveBreaches(newActiveBreaches);
        setUserStats(data.updatedStats);
        setBreachSuccessRate(data.successRate); // Store for later display
        setShowBreachModal(false);
        setSelectedPoi(null);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to start breach');
      }
    } catch (err) {
      console.error('Failed to start breach:', err);
      alert('Failed to start breach');
    } finally {
      setIsBreachConfirming(false);
    }
  };

  const handleViewBreachResults = async (poiItem: POI) => {
    const activeBreach = activeBreaches.get(poiItem.id);
    if (!activeBreach) {
      console.error('No active breach found for POI', poiItem.id);
      return;
    }

    try {
      console.log('Fetching breach results:', { historyId: activeBreach.id, poiId: poiItem.id });
      const res = await fetch(`/api/zones/breach-results?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeBreach.id, poiId: poiItem.id })
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Breach results received:', data);
        setBreachResults(data);
        setSelectedPoi(poiItem);
        
        // Remove from active breaches immediately
        const newActiveBreaches = new Map(activeBreaches);
        newActiveBreaches.delete(poiItem.id);
        setActiveBreaches(newActiveBreaches);
        
        // Update user stats
        if (data.updatedStats) {
          setUserStats(data.updatedStats);
        }
        
        // Check for level up
        if (data.levelUp && data.levelUp.leveledUp) {
          setNewLevel(data.levelUp.newLevel);
          setShowLevelUpModal(true);
        }
      } else {
        const error = await res.json();
        console.error('Breach results error:', error);
        alert(error.error || 'Failed to get breach results');
      }
    } catch (err) {
      console.error('Failed to get breach results:', err);
      alert('Failed to get breach results: ' + (err as Error).message);
    }
  };

  const handleBackFromBreachResults = async () => {
    // Dismiss the breach action
    if (breachResults && breachResults.historyId) {
      try {
        const dismissRes = await fetch('/api/zones/dismiss-breach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid, historyId: breachResults.historyId })
        });
        
        if (!dismissRes.ok) {
          console.error('Failed to dismiss breach');
        }
      } catch (err) {
        console.error('Failed to dismiss breach:', err);
      }
    }
    
    setBreachResults(null);
    setSelectedPoi(null);
    
    // Reload zone data to refresh history and POI
    try {
      const zoneRes = await fetch(`/api/zones/${zoneId}?fid=${userFid}`);
      if (zoneRes.ok) {
        const zoneData = await zoneRes.json();
        setHistory(zoneData.history || []);
        setPoi(zoneData.poi || []);
      }
    } catch (err) {
      console.error('Failed to reload zone data:', err);
    }
  };

  const loadAllHistory = async () => {
    try {
      const res = await fetch(`/api/zones/${zoneId}/all-history`);
      if (res.ok) {
        const data = await res.json();
        setAllHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to load all history:', err);
    }
  };

  // Load all history when switching to 'all' view
  useEffect(() => {
    if (historyView === 'all' && allHistory.length === 0) {
      loadAllHistory();
    }
  }, [historyView]);

  // Travel handlers
  const travelCost = 25;
  const isAtLocation = userLocation === zoneId;
  
  const canTravel = userStats && 
    userStats.current_stamina >= travelCost && 
    !isAtLocation && 
    !hasPhysicalActionInProgress;

  const handleTravelClick = () => {
    if (canTravel) {
      setShowTravelModal(true);
    }
  };

  const handleConfirmTravel = async () => {
    if (isTraveling) return;
    
    setIsTraveling(true);
    try {
      // Simulate travel time (2-3 seconds)
      await new Promise(resolve => setTimeout(resolve, 2500));

      const res = await fetch('/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid, zoneId })
      });

      if (res.ok) {
        const data = await res.json();
        setUserLocation(data.location);
        setUserStats(data.updatedStats);
        setShowTravelModal(false);
      }
    } catch (err) {
      console.error('Failed to travel:', err);
    } finally {
      setIsTraveling(false);
    }
  };

  // Countdown timer for active breaches
  useEffect(() => {
    if (activeBreaches.size === 0) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      let hasChanges = false;
      const newTimeRemaining = new Map<number, string>();

      activeBreaches.forEach((breach, poiId) => {
        if (breach.end_time) {
          const endTime = new Date(breach.end_time).getTime();
          const distance = endTime - now;

          let timeString: string;
          if (distance <= 0) {
            timeString = '00:00:00 to completion';
          } else {
            const hours = Math.floor(distance / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} to completion`;
          }

          newTimeRemaining.set(poiId, timeString);
          if (breachTimeRemaining.get(poiId) !== timeString) {
            hasChanges = true;
          }
        }
      });

      // Only update state if times have actually changed
      if (hasChanges) {
        setBreachTimeRemaining(newTimeRemaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBreaches, breachTimeRemaining]);

  if (Number.isNaN(zoneId)) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body p-6">
          <div className="text-red-400">Invalid zone ID</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body flex items-center justify-center min-h-[600px]">
          <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-fuschia rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="frame-container frame-main">
        <div className="frame-body p-6">
          <div className="text-gray-400">Zone not found</div>
        </div>
      </div>
    );
  }

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

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
        <a href="/city" className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors">
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </a>
        <div className="masthead">ZONE</div>
      </div>

      <div className="frame-body pt-0">

        {/* Zone Type Image */}
        <div className="w-full mb-6 overflow-hidden rounded relative">
          {zone.image_url ? (
            <img src={zone.image_url} alt={zone.name} className="w-full h-auto object-cover" />
          ) : (
            <div className="w-full h-48 bg-gray-700" />
          )}
          {zone.district_name && zone.district && (
            <a href={`/city/district/${zone.district}`} className="absolute top-3 left-3 px-3 py-1 bg-fuschia text-white text-xs font-bold uppercase rounded hover:opacity-80 transition-opacity">
              {zone.district_name}
            </a>
          )}
          {zone.zone_type_name && (
            <div className="absolute top-3 right-3 px-3 py-1 bg-cloud-gray text-white text-xs font-bold uppercase rounded">
              {zone.zone_type_name}
            </div>
          )}
        </div>

        {/* Zone Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white uppercase mb-2">{zone.name}</h1>
          <p className="text-gray-300">{zone.description || 'No description available.'}</p>
        </div>

        {/* Location Card */}
        <CxCard className="mb-6">
          {isAtLocation ? (
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-fuschia text-2xl">location_on</span>
              <span className="text-white font-semibold">You are here</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-gray-400">You are not here</span>
              </div>
              <button 
                className={`btn-cx btn-cx-primary ${canTravel ? '' : 'btn-cx-disabled'}`}
                onClick={handleTravelClick}
                disabled={!canTravel}
              >
                TRAVEL HERE
              </button>
              <div className="text-center text-gray-400 text-xs">
                {hasPhysicalActionInProgress ? (
                  <span className="text-yellow-400">Cannot travel during physical actions</span>
                ) : (
                  <span>Cost: 25 Stamina</span>
                )}
              </div>
            </div>
          )}
        </CxCard>

        {/* Actions */}
        <div className="mb-12">
          <h2 className="text-white font-bold uppercase text-lg mb-3">ACTIONS</h2>
            <div className="space-y-3">
              {(() => {
                // Define canScout based on location and stats
                const canScout = userStats && 
                  userStats.current_consciousness >= (userStats.max_consciousness * 0.5) &&
                  userStats.current_bandwidth >= 1 &&
                  userStats.current_stamina >= 10 &&
                  !hasPhysicalActionInProgress &&
                  isAtLocation;

                return (
                  <>
                    {scoutResults ? (
                      <div>
                        <ActionResultsSummary
                          actionName="Scout"
                          xpGained={scoutResults.xpGained}
                          discovery={
                            scoutResults.unlockedPOI ? {
                              type: 'poi' as const,
                              name: scoutResults.unlockedPOI.name
                            } : scoutResults.discoveredItem ? {
                              type: 'item' as const,
                              name: scoutResults.discoveredItem.name
                            } : undefined
                          }
                        />
                        
                        {scoutResults.unlockedPOI && (
                          <DiscoveryCard
                            discovery={{
                              type: 'poi',
                              name: scoutResults.unlockedPOI.name,
                              poiType: scoutResults.unlockedPOI.type
                            }}
                          />
                        )}
                        
                        {scoutResults.discoveredItem && (
                          <DiscoveryCard
                            discovery={{
                              type: 'item',
                              name: scoutResults.discoveredItem.name,
                              rarity: scoutResults.discoveredItem.rarity,
                              itemType: scoutResults.discoveredItem.type
                            }}
                          />
                        )}
                        
                        {scoutResults.encounter && (
                          <EncounterAlert encounter={scoutResults.encounter} />
                        )}

                        <ActionDismissButtons
                          encounter={scoutResults.encounter}
                          onDismiss={handleBackFromResults}
                        />
                      </div>
                    ) : activeScout ? (
                      <div>
                        <button 
                          className={`btn-cx btn-cx-pause btn-cx-full mb-2 ${!isScoutComplete || isLoadingResults ? 'cursor-default opacity-75' : ''}`}
                          onClick={handleViewResults}
                          disabled={!isScoutComplete || isLoadingResults}
                        >
                          {isLoadingResults ? 'LOADING RESULTS...' : isScoutComplete ? 'VIEW RESULTS' : 'SCOUTING IN PROGRESS'}
                        </button>
                        <div className="text-white text-center text-xs">{timeRemaining}</div>
                      </div>
                    ) : (
                      <button 
                        className={`btn-cx btn-cx-full ${canScout ? 'btn-cx-primary' : 'btn-cx-disabled'}`}
                        onClick={handleScoutClick}
                        disabled={!canScout}
                      >
                        SCOUT
                      </button>
                    )}
                    {zoneActions.map((action) => {
                      // Render action button based on effect_name
                      const actionName = action.effect_name?.toUpperCase() || 'ACTION';
                      return (
                        <button 
                          key={action.item_id} 
                          className="btn-cx btn-cx-action btn-cx-full relative flex items-center justify-center py-4" 
                          disabled
                        >
                          {action.slimsoft_image_url && (
                            <div className="absolute left-4">
                              <img 
                                src={action.slimsoft_image_url} 
                                alt={actionName} 
                                className="w-[50px] h-[50px]"
                              />
                            </div>
                          )}
                          <span 
                            className="text-xl"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {actionName}
                          </span>
                        </button>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>

        {/* Points of Interest */}
        {poi.length > 0 && (
          <div className="mb-6">
            {/* Terminals Section */}
            {poi.filter(p => p.poi_type !== 'shop').length > 0 && (
              <div className="mb-6">
                <h2 className="text-white font-bold uppercase text-lg mb-3">TERMINALS</h2>
                <div className="space-y-4">
                  {poi.filter(p => p.poi_type !== 'shop').map((poiItem) => (
                    <PoiCard
                      key={poiItem.id}
                      poiItem={poiItem}
                      isAtLocation={isAtLocation}
                      userStats={userStats}
                      activeBreach={activeBreaches.get(poiItem.id)}
                      timeLeft={breachTimeRemaining.get(poiItem.id) || ''}
                      breachResults={breachResults}
                      selectedPoi={selectedPoi}
                      hasPhysicalActionInProgress={hasPhysicalActionInProgress}
                      onBreachClick={handleBreachClick}
                      onViewBreachResults={handleViewBreachResults}
                      onBackFromBreachResults={handleBackFromBreachResults}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shops Section */}
            {poi.filter(p => p.poi_type === 'shop').length > 0 && (
              <div className="mb-6">
                <h2 className="text-white font-bold uppercase text-lg mb-3">SHOPS</h2>
                <div className="space-y-4">
                  {poi.filter(p => p.poi_type === 'shop').map((shop) => {
                    // Check if shop was recently unlocked (within last 24 hours)
                    const isNewlyUnlocked = shop.unlocked_at && 
                      (new Date().getTime() - new Date(shop.unlocked_at).getTime()) < 24 * 60 * 60 * 1000;
                    
                    return (
                      <CxCard key={shop.id}>
                        <div className="flex gap-4 items-stretch relative">
                          {/* NEW alert badge */}
                          {isNewlyUnlocked && (
                            <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse z-10">
                              NEW
                            </div>
                          )}
                          
                          {/* Left side: Shop Image */}
                          <div className="w-[75px] h-[75px] flex-shrink-0">
                            {shop.image_url ? (
                              <img src={shop.image_url} alt={shop.name} className="w-full h-full object-contain" />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-3xl">
                                🏪
                              </div>
                            )}
                          </div>
                          
                          {/* Right side: Title and Button stacked */}
                          <div className="flex-1 flex flex-col justify-center gap-2">
                            <h3 className="text-white font-bold uppercase text-sm">{shop.name}</h3>
                            {isAtLocation ? (
                              <a href={`/shops/${shop.id}`}>
                                <button className="btn-cx btn-cx-primary btn-cx-full">
                                  SHOP
                                </button>
                              </a>
                            ) : (
                              <button className="btn-cx btn-cx-disabled btn-cx-full" disabled>
                                SHOP (NOT HERE)
                              </button>
                            )}
                          </div>
                        </div>
                      </CxCard>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Breach Results - shown inline in POI section */}

        {/* History */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold uppercase text-lg">ACTIVITY</h2>
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
                  No activity in this zone yet.
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
                  No activity in this zone yet.
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

      {/* Breach Confirmation Modal */}
      {showBreachModal && selectedPoi && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="modal-base">
            <div className="modal-title">Breach this access point?</div>
            <div className="modal-body">
              Search the subnet for access to items, data, or funds.
            </div>
            {isAtLocation ? (
              <>
                <div className="bg-green-900 bg-opacity-30 border border-green-500 text-green-400 px-3 py-2 rounded text-sm mb-2">
                  You are at this location so you can perform a physical Breach.
                </div>
                <div className="modal-body-data">
                  Cost: 15 Charge, 15 Stamina, 1 Bandwidth
                </div>
              </>
            ) : (
              <>
                <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 text-yellow-400 px-3 py-2 rounded text-sm mb-2">
                  You are not physically at this location so you can perform a remote Breach.
                </div>
                <div className="modal-body-data">
                  Cost: 10 Charge, 1 Bandwidth
                </div>
              </>
            )}
            <div className="modal-body-data">
              Duration: 1 hour
            </div>
            <div className="flex gap-3 mt-4">
              <button 
                className="btn-cx btn-cx-secondary flex-1"
                onClick={() => {
                  setShowBreachModal(false);
                  setSelectedPoi(null);
                }}
              >
                CANCEL
              </button>
              <button 
                className="btn-cx btn-cx-primary flex-1"
                onClick={handleConfirmBreach}
                disabled={isBreachConfirming}
              >
                {isBreachConfirming ? 'CONFIRMING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scout Confirmation Modal */}
      {showScoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="modal-base">
            <div className="modal-title">Scout this location?</div>
            <div className="modal-body">
              Discover new Points of Interest, items, contacts, and data.
            </div>
            <div className="modal-body-data">
              Cost: 50%+ Consciousness, {staminaCost} Stamina
            </div>
            <div className="modal-body-data">
              Duration: 1 hour
            </div>
            <div className="flex gap-3 mt-4">
              <button 
                className="btn-cx btn-cx-secondary flex-1"
                onClick={() => setShowScoutModal(false)}
              >
                CANCEL
              </button>
              <button 
                className="btn-cx btn-cx-primary flex-1"
                onClick={handleConfirmScout}
                disabled={isConfirming}
              >
                {isConfirming ? 'CONFIRMING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Travel Confirmation Modal */}
      {showTravelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="modal-base">
            <div className="modal-title">Do you want to travel here?</div>
            <div className="modal-body-data">
              Cost: 25 Stamina
            </div>
            {isTraveling && (
              <div className="flex items-center justify-center my-4">
                <span className="material-symbols-outlined text-fuschia text-4xl animate-pulse">directions_walk</span>
              </div>
            )}
            {!isTraveling && (
              <div className="flex gap-3 mt-4">
                <button 
                  className="btn-cx btn-cx-secondary flex-1"
                  onClick={() => setShowTravelModal(false)}
                >
                  CANCEL
                </button>
                <button 
                  className="btn-cx btn-cx-primary flex-1"
                  onClick={handleConfirmTravel}
                >
                  CONFIRM
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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