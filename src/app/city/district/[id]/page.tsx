"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NavStrip, CxCard } from '../../../../components/CxShared';
import NavDrawer from '../../../../components/NavDrawer';
import { useNavData } from '../../../../hooks/useNavData';
import { useAuthenticatedUser } from '../../../../hooks/useAuthenticatedUser';

interface District {
  id: number;
  name: string;
  description?: string;
}

interface Zone {
  id: number;
  name: string;
  zone_type: number;
  zone_type_name?: string;
  district_name?: string;
  description: string;
  image_url?: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id }) => {
      setDistrictId(parseInt(id, 10));
    });
  }, [params]);

  useEffect(() => {
    if (!districtId || Number.isNaN(districtId) || !userFid || isAuthLoading) return;

    async function loadData() {
      try {
        // Fetch district details
        const districtRes = await fetch(`/api/districts/${districtId}?fid=${userFid}`);

        // Process district details
        if (districtRes.ok) {
          const districtData = await districtRes.json();
          setDistrict(districtData.district);
          setZones(districtData.zones || []);
          setHistory(districtData.history || []);
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

      <div className="pt-5 pb-2 px-6 flex flex-row gap-1 items-center">
        <button 
          onClick={handleBackToCity}
          className="w-[25px] h-[25px] rounded-full overflow-hidden bg-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-colors"
        >
          <span className="material-symbols-outlined text-white text-xl">chevron_left</span>
        </button>
        <div className="masthead">DISTRICT</div>
      </div>

      <div className="frame-body">
        {/* City Map */}
        <CxCard className="mb-6 city-map">
        </CxCard>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white uppercase mb-2">{district.name}</h1>
          {district.description && (
          <p className="text-gray-300">{district.description || 'No description available.'}</p>
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
          <div className="space-y-3 mb-6">
            {zones.map((zone) => (
              <CxCard key={zone.id} href={`/city/${zone.id}`}>
                <div className="flex flex-col gap-2">
                  <div className="flex direction-row justify-between items-center">
                    <span className="pill-cloud-gray uppercase">{zone.zone_type_name || zone.zone_type}</span>
                  </div>
                  <div className="card-title">{zone.name}</div>
                </div>
              </CxCard>
            ))}
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
