"use client";
import React from 'react';
import { CxCard } from './CxShared';
import { ActionResultsSummary } from './ActionResultsSummary';
import { DiscoveryCard } from './DiscoveryCard';
import { EncounterAlert } from './EncounterAlert';
import { ActionDismissButtons } from './ActionDismissButtons';

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
        
        {/* Right side: Title and Status */}
        <div className="flex-1 flex flex-col justify-center gap-2">
          <h3 className="text-white font-bold uppercase text-sm">{poiItem.name}</h3>
          
          {breachResults && selectedPoi?.id === poiItem.id ? (
            <div className="text-fuschia text-xs font-semibold uppercase">
              Viewing Results ↓
            </div>
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
                {isBreachComplete ? 'VIEW RESULTS' : 'IN PROGRESS'}
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
          <ActionResultsSummary
            actionName="Breach"
            xpGained={breachResults.xpGained}
            discovery={
              breachResults.unlockedPOI ? {
                type: 'poi' as const,
                name: breachResults.unlockedPOI.name
              } : breachResults.discoveredItem ? {
                type: 'item' as const,
                name: breachResults.discoveredItem.name
              } : undefined
            }
            className="border-0 p-0"
          />
          
          {breachResults.unlockedPOI && (
            <DiscoveryCard
              discovery={{
                type: 'poi',
                name: breachResults.unlockedPOI.name,
                poiType: breachResults.unlockedPOI.type
              }}
              className="rounded p-3 bg-green-900/10"
            />
          )}
          
          {breachResults.discoveredItem && (
            <DiscoveryCard
              discovery={{
                type: 'item',
                name: breachResults.discoveredItem.name,
                rarity: breachResults.discoveredItem.rarity,
                itemType: breachResults.discoveredItem.type
              }}
              className="rounded p-3 bg-green-900/10"
            />
          )}
          
          {breachResults.encounter && (
            <EncounterAlert
              encounter={breachResults.encounter}
              className="rounded p-3 bg-yellow-900/10"
            />
          )}
          
          <ActionDismissButtons
            encounter={breachResults.encounter}
            onDismiss={onBackFromBreachResults}
            className="mt-3"
          />
        </div>
      )}
    </CxCard>
  );
}
