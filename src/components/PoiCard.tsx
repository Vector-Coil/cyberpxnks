"use client";
import React from 'react';
import { CxCard } from './CxShared';

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

interface PoiCardProps {
  poiItem: POI;
  isAtLocation: boolean;
  userStats: UserStats | null;
  activeBreach?: any;
  timeLeft?: string;
  breachResults?: any;
  selectedPoi?: POI | null;
  hasPhysicalActionInProgress?: boolean;
  onBreachClick: (poi: POI) => void;
  onViewBreachResults: (poi: POI) => void;
  onBackFromBreachResults: () => void;
}

export default function PoiCard({
  poiItem,
  isAtLocation,
  userStats,
  activeBreach,
  timeLeft = '',
  breachResults,
  selectedPoi,
  hasPhysicalActionInProgress = false,
  onBreachClick,
  onViewBreachResults,
  onBackFromBreachResults
}: PoiCardProps) {
  const isBreachComplete = timeLeft.startsWith('00:00:00');
  
  // Physical breach: 15 Charge + 15 Stamina + 1 Bandwidth
  // Remote breach: 10 Charge + 1 Bandwidth
  const requiredCharge = isAtLocation ? 15 : 10;
  const requiredStamina = isAtLocation ? 15 : 0;
  
  const canBreach = userStats && 
    userStats.current_bandwidth >= 1 &&
    userStats.current_charge >= requiredCharge &&
    userStats.current_stamina >= requiredStamina &&
    !activeBreach &&
    !hasPhysicalActionInProgress;

  // Check if POI was recently unlocked (within last 24 hours)
  const isNewlyUnlocked = poiItem.unlocked_at && 
    (new Date().getTime() - new Date(poiItem.unlocked_at).getTime()) < 24 * 60 * 60 * 1000;

  console.log('PoiCard render:', { id: poiItem.id, name: poiItem.name, image_url: poiItem.image_url });

  return (
    <CxCard>
      <div className="flex gap-4 items-stretch relative">
        {/* NEW alert badge */}
        {isNewlyUnlocked && (
          <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-bright-green text-black text-xs font-semibold px-2 py-0.5 rounded-full shadow-xl animate-pulse z-10">
            NEW
          </div>
        )}
        
        {/* Left side: POI Image */}
        {poiItem.image_url && (
          <div className="w-[75px] h-[75px] flex-shrink-0">
            <img src={poiItem.image_url} alt={poiItem.name} className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Right side: Title and Button stacked */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <h3 className="text-white font-bold uppercase text-sm">{poiItem.name}</h3>
          
          {breachResults && selectedPoi?.id === poiItem.id ? (
            <button 
              className="btn-cx btn-cx-secondary btn-cx-full"
              onClick={onBackFromBreachResults}
            >
              DISMISS
            </button>
          ) : activeBreach ? (
            <>
              <button 
                className={`btn-cx btn-cx-pause btn-cx-full ${!isBreachComplete ? 'cursor-default opacity-75' : ''}`}
                onClick={() => {
                  if (isBreachComplete) {
                    onViewBreachResults(poiItem);
                  }
                }}
                disabled={!isBreachComplete}
              >
                {isBreachComplete ? 'RESULTS' : 'IN PROGRESS'}
              </button>
              <div className="text-white text-center text-xs">{timeLeft}</div>
            </>
          ) : (
            <button 
              className={`btn-cx btn-cx-full btn-cx-harsh ${canBreach ? '' : 'btn-cx-disabled'}`}
              onClick={() => onBreachClick(poiItem)}
              disabled={!canBreach}
            >
              BREACH
            </button>
          )}
        </div>
      </div>
      
      {/* Results Row - Full Width Below */}
      {breachResults && selectedPoi?.id === poiItem.id && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="mb-3">
            <div className="text-fuschia font-bold uppercase text-sm mb-2">Breach Results</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">XP Gained</span>
                <span className="pill-cloud-gray">{breachResults.xpGained} XP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">Terminal</span>
                <span className="text-white text-sm">{poiItem.name}</span>
              </div>
              {breachResults.unlockedPOI && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Discovery</span>
                  <span className="pill-bright-green text-xs">{breachResults.unlockedPOI.name}</span>
                </div>
              )}
            </div>
          </div>
          
          {breachResults.unlockedPOI && (
            <div className="mb-3 border-2 border-bright-green/50 rounded p-3 bg-green-900/10">
              <div className="text-bright-green font-bold uppercase text-sm mb-2">✨ Discovery</div>
              <div className="text-gray-300 text-sm">
                You discovered <span className="text-white font-semibold">{breachResults.unlockedPOI.name}</span>, a new{' '}
                <span className="text-cyan-400">{breachResults.unlockedPOI.type === 'shop' ? 'shop' : 'terminal'}</span> in this zone!
              </div>
            </div>
          )}
          
          {/* Encounter Card */}
          {breachResults.encounter && (
            <div className="mb-3 border-2 border-yellow-500/50 rounded p-3 bg-yellow-900/10">
              <div className="text-yellow-400 font-bold uppercase text-sm mb-2">⚠ Encounter Detected</div>
              <div className="text-gray-300 text-sm mb-3">
                You've encountered <span className="text-white font-semibold">{breachResults.encounter.name}</span>, 
                a <span className="text-cyan-400">{breachResults.encounter.type}</span> with{' '}
                <span className={`font-semibold ${
                  breachResults.encounter.sentiment === 'attack' ? 'text-red-500' :
                  breachResults.encounter.sentiment === 'hostile' ? 'text-orange-500' :
                  breachResults.encounter.sentiment === 'neutral' ? 'text-yellow-400' :
                  'text-green-400'
                }`}>{breachResults.encounter.sentiment}</span> intentions.
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn-cx btn-cx-primary flex-1 text-sm py-2"
                  onClick={() => window.location.href = `/encounters/${breachResults.encounter.id}`}
                >
                  OPEN ENCOUNTER
                </button>
                <button 
                  className="btn-cx btn-cx-secondary flex-1 text-sm py-2"
                  onClick={onBackFromBreachResults}
                >
                  RUN AWAY
                </button>
              </div>
            </div>
          )}
          
          {/* Dismiss button (only show if no encounter or after handling encounter) */}
          {!breachResults.encounter && (
            <button 
              className="btn-cx btn-cx-secondary btn-cx-auto"
              onClick={onBackFromBreachResults}
            >
              DISMISS
            </button>
          )}
        </div>
      )}
    </CxCard>
  );
}
