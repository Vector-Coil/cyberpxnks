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
    !activeBreach;

  console.log('PoiCard render:', { id: poiItem.id, name: poiItem.name, image_url: poiItem.image_url });

  return (
    <CxCard>
      <div className="flex gap-4 items-stretch">
        {/* Left side: Image + Info (2/3 width) */}
        <div className="flex flex-1" style={{ gap: '6px' }}>
          {/* POI Image */}
          {poiItem.image_url && (
            <div className="w-[75px] h-[75px] flex-shrink-0">
              <img src={poiItem.image_url} alt={poiItem.name} className="w-full h-full object-contain" />
            </div>
          )}
          
          {/* POI Info */}
          <div className="flex-1">
            <h3 className="text-white font-bold uppercase text-sm mb-1">{poiItem.name}</h3>
            <p className="text-gray-400 text-xs">{poiItem.description || 'Terminal access point'}</p>
          </div>
        </div>
        
        {/* Right side: Breach Button or Status (1/3 width) */}
        <div className="w-1/3 flex flex-col justify-center">
          {breachResults && selectedPoi?.id === poiItem.id ? (
            <>
              <div className="modal-base mb-2">
                <div className="modal-title mb-2">BREACH RESULTS</div>
                <div className="modal-body">
                  <div className="modal-body-data space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Gained XP</span>
                      <span className="pill-cloud-gray">{breachResults.xpGained} XP</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Terminal</span>
                      <span className="text-white">{poiItem.name}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                className="btn-cx btn-cx-secondary btn-cx-full"
                onClick={onBackFromBreachResults}
              >
                DISMISS
              </button>
            </>
          ) : activeBreach ? (
            <>
              <button 
                className={`btn-cx btn-cx-pause mb-2 ${!isBreachComplete ? 'cursor-default opacity-75' : ''}`}
                onClick={() => {
                  if (isBreachComplete) {
                    onViewBreachResults(poiItem);
                  }
                }}
                disabled={!isBreachComplete}
              >
                {isBreachComplete ? 'VIEW RESULTS' : 'BREACH IN PROGRESS'}
              </button>
              <div className="text-white text-center text-xs">{timeLeft}</div>
            </>
          ) : (
            <button 
              className={`btn-cx-auto btn-cx-harsh ${canBreach ? '' : 'btn-cx-disabled'}`}
              onClick={() => onBreachClick(poiItem)}
              disabled={!canBreach}
            >
              BREACH
            </button>
          )}
        </div>
      </div>
    </CxCard>
  );
}
