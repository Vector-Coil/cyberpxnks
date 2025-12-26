"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../../components/CxShared';
import NavDrawer from '../../../../components/NavDrawer';
import ZoneCard from '../../../../components/ZoneCard';
import { useNavData } from '../../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../../hooks/useAuthenticatedUser';

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [district, setDistrict] = useState<District | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

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

  if (loading) {
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

      <div className="pt-5 pb-2 px-6 flex flex-row gap-3 items-center">
        <button 
          onClick={handleBackToCity}
          className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
        >
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </button>
        <div className="masthead">DISTRICT</div>
      </div>

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
