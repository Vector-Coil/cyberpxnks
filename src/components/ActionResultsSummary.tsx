"use client";
import React from 'react';

interface Discovery {
  type: 'zone' | 'district' | 'poi' | 'item' | 'subnet' | 'contact';
  name: string;
}

interface ActionResultsSummaryProps {
  actionName: string;
  xpGained: number;
  discovery?: Discovery | null;
  className?: string;
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
  discovery,
  className = ''
}: ActionResultsSummaryProps) {
  return (
    <div className={`modal-base mb-2 ${className}`}>
      <div className="modal-title mb-2">{actionName.toUpperCase()} RESULTS</div>
      <div className="modal-body-data space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Gained XP</span>
          <span className="pill-cloud-gray">{xpGained} XP</span>
        </div>
        {discovery && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Discovery</span>
            <span className="pill-bright-green">{discovery.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
