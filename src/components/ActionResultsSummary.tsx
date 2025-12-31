"use client";
import React from 'react';

interface Discovery {
  type: 'zone' | 'district' | 'poi' | 'item' | 'subnet' | 'contact';
  name: string;
}

interface Penalties {
  stamina: number;
  consciousness: number;
  charge: number;
  neural: number;
  thermal: number;
}

interface ActionResultsSummaryProps {
  actionName: string;
  xpGained: number;
  creditsGained?: number;
  discovery?: Discovery | null;
  className?: string;
  failed?: boolean;
  criticalFailure?: boolean;
  penalties?: Penalties;
}

/**
 * Unified component for displaying action results summary.
 * Shows XP gained and basic discovery info in a consistent format.
 * 
 * Used by: Explore, Scout, Breach, Overnet Scan, etc.
 */
export function ActionResultsSummary({
  actionName,
  xpGained,
  creditsGained,
  discovery,
  className = '',
  failed = false,
  criticalFailure = false,
  penalties
}: ActionResultsSummaryProps) {
  return (
    <div className={`modal-base mb-2 ${className}`}>
      <div className={`modal-title mb-2 ${failed ? 'text-red-500' : 'text-bright-green'}`}>
        {failed ? (
          <>
            {actionName.toUpperCase()} FAILED
            {criticalFailure && <span className="ml-2 text-xs">(CRITICAL)</span>}
          </>
        ) : (
          `${actionName.toUpperCase()} SUCCESS`
        )}
      </div>
      <div className="modal-body-data space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Gained XP</span>
          <span className={`${failed ? 'pill-cloud-gray' : 'pill-cloud-gray'}`}>{xpGained} XP{failed && ' (25%)'}</span>
        </div>
        {creditsGained !== undefined && creditsGained > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Gained Credits</span>
            <span className="pill-cloud-gray">{creditsGained} Credits</span>
          </div>
        )}
        {failed && penalties && (
          <div className="space-y-1 mt-2 pt-2 border-t border-gray-700">
            <div className="text-red-400 text-xs font-semibold mb-1">PENALTIES:</div>
            {penalties.stamina !== 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Stamina</span>
                <span className="text-red-400">{penalties.stamina}</span>
              </div>
            )}
            {penalties.consciousness !== 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Consciousness</span>
                <span className="text-red-400">{penalties.consciousness}</span>
              </div>
            )}
            {penalties.charge !== 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Charge</span>
                <span className="text-red-400">{penalties.charge}</span>
              </div>
            )}
            {penalties.neural !== 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Neural Load</span>
                <span className="text-red-400">+{penalties.neural}</span>
              </div>
            )}
            {penalties.thermal !== 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Thermal Load</span>
                <span className="text-red-400">+{penalties.thermal}</span>
              </div>
            )}
          </div>
        )}
        {discovery && !failed && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Discovery</span>
            <span className="pill-bright-green">{discovery.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

