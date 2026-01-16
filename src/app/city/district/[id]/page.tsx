"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../../components/CxShared';
import ZoneCard from '../../../../components/ZoneCard';
import NavDrawer from '../../../../components/NavDrawer';
import { useNavData } from '../../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../../hooks/useAuthenticatedUser';
import { useCountdownTimer } from '../../../../hooks/useCountdownTimer';
import { ActionResultsSummary } from '../../../../components/ActionResultsSummary';

interface District {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
}

interface Zone {
  id: number;
  name: string;
  zone_type: number;
  zone_type_name?: string;
  district_name?: string;
  description: string;
  image_url?: string;
  shop_count?: number;
  terminal_count?: number;
}

interface HistoryEntry {
  id: number;
  message: string;
  timestamp: string;
  action_type: string;
  zone_id: number;
  zone_name: string;
}

export default function DistrictDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [districtId, setDistrictId] = useState<number | null>(null);
  const { userFid, isLoading: isAuthLoading } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);

  const [district, setDistrict] = useState<District | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isStartingExplore, setIsStartingExplore] = useState(false);
  const [activeExplore, setActiveExplore] = useState<any | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [exploreResults, setExploreResults] = useState<any>(null);

  useEffect(() => {
    params.then(({ id }) => {
      setDistrictId(parseInt(id, 10));
    });
  }, [params]);

  useEffect(() => {
    if (!districtId || Number.isNaN(districtId) || !userFid || isAuthLoading) return;

    async function loadData() {
      try {
        // Parallelize API calls
        const [districtRes, alertsRes, jobsRes] = await Promise.all([
          fetch(`/api/districts/${districtId}?fid=${userFid}`),
          fetch(`/api/alerts?fid=${userFid}`),
          fetch(`/api/active-jobs?fid=${userFid}`)
        ]);

        // Process district details
        if (districtRes.ok) {
          const districtData = await districtRes.json();
          setDistrict(districtData.district);
          setZones(districtData.zones || []);
          setHistory(districtData.history || []);
          // Detect an in-progress district-level Exploring action and set activeExplore
          const inProgress = (districtData.history || []).find((h: any) =>
            h.action_type === 'Exploring' && h.end_time && !h.result_status && (h.zone_id === null || h.zone_id === undefined)
          );
          if (inProgress) setActiveExplore(inProgress);
        }

        // Process user location
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (alertsData.location?.zoneId) {
            setCurrentLocationId(alertsData.location.zoneId);
          }
        }

        // Process active jobs
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setActiveJobs(jobsData.jobs || []);
        }
      } catch (err) {
        console.error('Failed to load district data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [districtId, userFid, isAuthLoading]);

  const handleBackToCity = () => {
    router.push('/city');
  };

  const { timeRemaining, isComplete } = useCountdownTimer(activeExplore?.end_time || null);

  const handleViewResults = async () => {
    if (!activeExplore || isLoadingResults || !userFid || !districtId) return;
    setIsLoadingResults(true);
    try {
      const res = await fetch(`/api/districts/${districtId}/explore-results?fid=${userFid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeExplore.id })
      });
      if (res.ok) {
        const data = await res.json();
        setExploreResults(data);
        setShowResults(true);
      } else {
        console.error('Failed to fetch explore results', await res.text());
      }
    } catch (err) {
      console.error('Failed to fetch scout results', err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleBackFromResults = async () => {
    // Dismiss the explore action if present
    if (exploreResults && exploreResults.historyId) {
      try {
        await fetch(`/api/districts/${districtId}/dismiss-explore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid, historyId: exploreResults.historyId })
        });
      } catch (err) {
        console.warn('Failed to dismiss district explore action:', err);
      }
    }

    setShowResults(false);
    setExploreResults(null);
    setActiveExplore(null);

    try {
      const [districtRes, alertsRes, jobsRes] = await Promise.all([
        fetch(`/api/districts/${districtId}?fid=${userFid}`),
        fetch(`/api/alerts?fid=${userFid}`),
        fetch(`/api/active-jobs?fid=${userFid}`)
      ]);

      if (districtRes.ok) {
        const districtData = await districtRes.json();
        setDistrict(districtData.district);
        setZones(districtData.zones || []);
        setHistory(districtData.history || []);
        const inProgress = (districtData.history || []).find((h: any) =>
          h.action_type === 'Exploring' && h.end_time && !h.result_status && (h.zone_id === null || h.zone_id === undefined)
        );
        if (inProgress) setActiveExplore(inProgress);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (alertsData.location?.zoneId) {
          setCurrentLocationId(alertsData.location.zoneId);
        }
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setActiveJobs(jobsData.jobs || []);
      }
    } catch (err) {
      console.error('Failed to reload district after results:', err);
    }
  };

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

  if (!district) {
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
          <div className="text-center text-gray-400 py-12">
            District not found
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

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
        <button 
          onClick={handleBackToCity}
          className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
        >
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </button>
        <div className="masthead">DISTRICT</div>
      </div>

      <div className="pt-2 pb-4 px-6">
        <button
          className={`btn-cx btn-cx-primary w-full ${isStartingExplore ? 'opacity-70 cursor-wait' : ''}`}
          onClick={async () => {
            if (!userFid || !districtId || isStartingExplore) return;
            setIsStartingExplore(true);
            try {
              const res = await fetch(`/api/districts/${districtId}/explore?fid=${userFid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staminaCost: 15 })
              });
                if (res.ok) {
                const data = await res.json();
                // If API returned the created explore action, set it so timer displays
                if (data.scoutAction) {
                  // backward compatibility: scoutAction key may be present
                        setActiveExplore(data.scoutAction);
                }
                if (data.exploreAction) {
                  setActiveExplore(data.exploreAction);
                }
                  // Refresh active jobs to reflect the new scout action
                  const jobsRes = await fetch(`/api/active-jobs?fid=${userFid}`);
                  if (jobsRes.ok) {
                    const jobsData = await jobsRes.json();
                    setActiveJobs(jobsData.jobs || []);
                  }
                } else {
                      const errText = await res.text();
                      console.error('Failed to start district explore:', errText);
              }
            } catch (err) {
              console.error('Failed to start district explore:', err);
            } finally {
              setIsStartingExplore(false);
            }
          }}
          disabled={isStartingExplore}
        >
          {isStartingExplore ? 'EXPLORING...' : 'EXPLORE DISTRICT'}
        </button>
      </div>

      {/* Active district explore timer / view results */}
      {activeExplore && !showResults && (
        <CxCard className="mb-6">
          <div className="text-center">
            {!isComplete ? (
              <>
                <h3 className="text-white font-bold uppercase mb-2">Exploring District</h3>
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
        <div className="mb-6 px-6">
          <CxCard>
            <div className="text-center mb-4">
              <h3 className="text-white font-bold uppercase mb-2">Results Summary</h3>
            </div>
            <ActionResultsSummary
              actionName="Explore"
              xpGained={exploreResults.xpGained || 0}
              discovery={exploreResults.discoveredZone ? { type: 'zone', name: exploreResults.discoveredZone.name } : null}
            />
            <div className="mt-4 text-center">
              <button className="btn-cx w-full btn-cx-primary" onClick={handleBackFromResults}>BACK</button>
            </div>
          </CxCard>
        </div>
      )}

      <div className="frame-body">
        {/* District Map */}
        <div className="mb-6 city-map" style={district?.image_url ? {
          backgroundImage: `url(${district.image_url})`
        } : undefined}>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white uppercase mb-2">{district.name}</h1>
          {district.description && (
          <p className="text-gray-300 text-left">{district.description || 'No description available.'}</p>
          )}
        </div>

        {/* Discovered Zones Section */}
        <div className="mb-4">
          <h2 className="text-white font-bold uppercase text-lg mb-1">
            DISCOVERED ZONES ({zones.length})
          </h2>
        </div>

        {zones.length === 0 ? (
          <div className="text-center text-gray-400 py-12 mb-6">
            No zones discovered in this district yet.
          </div>
        ) : (
          <div className="space-y-1 mb-6">
            {zones.map((zone) => {
              // Check if zone has active or completed actions
              const zoneJobs = activeJobs.filter(job => 
                job.zone_id === zone.id && 
                (job.action_type === 'Scouted' || job.action_type === 'Breached')
              );
              const hasCompleted = zoneJobs.some(job => 
                new Date(job.end_time) <= new Date() && !job.result_status
              );
              const hasInProgress = zoneJobs.some(job => 
                new Date(job.end_time) > new Date()
              );
              
              let actionStatus: { type: "scout" | "breach"; status: "completed" | "in_progress"; poiName?: string } | undefined = undefined;
              if (hasCompleted) {
                const completedJob = zoneJobs.find(job => new Date(job.end_time) <= new Date() && !job.result_status);
                actionStatus = {
                  type: completedJob.action_type === 'Scouted' ? 'scout' as const : 'breach' as const,
                  status: 'completed' as const,
                  poiName: completedJob.poi_name
                };
              } else if (hasInProgress) {
                const inProgressJob = zoneJobs.find(job => new Date(job.end_time) > new Date());
                actionStatus = {
                  type: inProgressJob.action_type === 'Scouted' ? 'scout' as const : 'breach' as const,
                  status: 'in_progress' as const,
                  poiName: inProgressJob.poi_name
                };
              }

              return (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  isCurrentLocation={zone.id === currentLocationId}
                  href={`/city/${zone.id}`}
                  actionStatus={actionStatus}
                />
              );
            })}
          </div>
        )}

        {/* District Activity Section */}
        <div className="mb-4">
          <h2 className="text-white font-bold uppercase text-lg mb-1">
            DISTRICT ACTIVITY
          </h2>
        </div>

        <CxCard>
          {history.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No activity in this district yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
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
          )}
        </CxCard>
      </div>
    </div>
    </>
  );
}
