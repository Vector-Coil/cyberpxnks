import React, { useState, useEffect } from 'react';
import { CxCard } from './CxShared';
import ZoneCard from './ZoneCard';

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

interface CollapsibleDistrictCardProps {
  district: District;
  userLevel: number;
  currentLocationId: number | null;
  activeJobs: any[];
  storageKey: string;
}

function getDistrictLevelBadge(districtLevel: number, userLevel: number) {
  const levelDiff = districtLevel - userLevel;
  
  if (levelDiff <= 0) {
    // District at or below user level - blue badge with number
    return {
      color: 'bg-cyan-500',
      content: `LVL ${districtLevel}`,
      textColor: 'text-white'
    };
  } else if (levelDiff === 1) {
    // District 1 level above - yellow badge with number
    return {
      color: 'bg-yellow-500',
      content: `LVL ${districtLevel}`,
      textColor: 'text-gray-900'
    };
  } else if (levelDiff === 2) {
    // District 2 levels above - orange badge with skull
    return {
      color: 'bg-orange-500',
      content: '☠',
      textColor: 'text-white'
    };
  } else {
    // District 3+ levels above - red badge with skull
    return {
      color: 'bg-red-500',
      content: '☠',
      textColor: 'text-white'
    };
  }
}

export default function CollapsibleDistrictCard({
  district,
  userLevel,
  currentLocationId,
  activeJobs,
  storageKey
}: CollapsibleDistrictCardProps) {
  // Load initial collapse state from localStorage, default to expanded
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });

  // Save collapse state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, storageKey]);

  const badge = getDistrictLevelBadge(district.level, userLevel);

  // Sort zones: prioritize current location and active jobs, then by discovery time
  const sortedZones = [...district.zones].sort((a, b) => {
    const aIsCurrent = a.id === currentLocationId;
    const bIsCurrent = b.id === currentLocationId;
    const aHasActiveJob = activeJobs.some(job => job.zone_id === a.id);
    const bHasActiveJob = activeJobs.some(job => job.zone_id === b.id);
    
    // Current location comes first
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;
    
    // Then zones with active jobs
    if (aHasActiveJob && !bHasActiveJob) return -1;
    if (!aHasActiveJob && bHasActiveJob) return 1;
    
    // Then by discovery time (earliest first)
    const aTime = a.discovery_time ? new Date(a.discovery_time).getTime() : 0;
    const bTime = b.discovery_time ? new Date(b.discovery_time).getTime() : 0;
    return aTime - bTime;
  });

  return (
    <CxCard className="mb-3">
      {/* District Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            aria-label={isCollapsed ? 'Expand district' : 'Collapse district'}
          >
            <span className="material-symbols-outlined text-white text-xl">
              {isCollapsed ? 'chevron_right' : 'expand_more'}
            </span>
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold uppercase text-lg">{district.name}</h3>
              <span className={`px-2 py-1 ${badge.color} ${badge.textColor} text-xs font-bold uppercase rounded`}>
                {badge.content}
              </span>
              <span className="text-gray-400 text-sm">
                ({district.zones.length} {district.zones.length === 1 ? 'zone' : 'zones'})
              </span>
            </div>
          </div>

          <a
            href={`/city/district/${district.id}`}
            className="px-4 py-2 bg-fuschia hover:bg-fuschia/80 text-white text-xs font-bold uppercase rounded transition-colors whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            VIEW DISTRICT
          </a>
        </div>
      </div>

      {/* Zones List */}
      {!isCollapsed && (
        <div className="space-y-1">
          {sortedZones.map((zone) => {
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
    </CxCard>
  );
}
