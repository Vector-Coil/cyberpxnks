"use client";
import React from 'react';

export interface Discovery {
  type: 'zone' | 'district' | 'poi' | 'item' | 'subnet' | 'contact';
  name: string;
  description?: string;
  // Type-specific fields
  districtName?: string;      // For zones
  poiCount?: number;           // For zones
  rarity?: string;             // For items
  itemType?: string;           // For items
  poiType?: string;            // For POIs
}

interface DiscoveryCardProps {
  discovery: Discovery;
  className?: string;
}

/**
 * Unified component for displaying detailed discovery information.
 * Handles different discovery types with appropriate styling and messaging.
 * 
 * Discovery Types:
 * - zone: New zone discovered during Explore
 * - poi: New terminal/shop discovered during Scout/Breach
 * - item: New item discovered during any action
 * - subnet: New subnet discovered during Overnet Scan
 * - contact: New contact discovered (future)
 * - district: New district discovered (future)
 */
export function DiscoveryCard({ discovery, className = '' }: DiscoveryCardProps) {
  const getTitle = () => {
    switch (discovery.type) {
      case 'zone':
        return '✨ DISCOVERY';
      case 'poi':
        return '✨ DISCOVERY';
      case 'item':
        return '✨ ITEM DISCOVERY';
      case 'subnet':
        return '✨ SUBNET DISCOVERED';
      case 'contact':
        return '✨ CONTACT DISCOVERED';
      case 'district':
        return '✨ DISTRICT DISCOVERED';
      default:
        return '✨ DISCOVERY';
    }
  };

  const getDescription = () => {
    switch (discovery.type) {
      case 'zone':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>
            {discovery.districtName && (
              <> in <span className="text-cyan-400">{discovery.districtName}</span></>
            )}!
            {(discovery.poiCount ?? 0) > 0 && (
              <span className="block mt-1 text-gray-400 text-xs">
                This zone contains {discovery.poiCount} point{discovery.poiCount !== 1 ? 's' : ''} of interest.
              </span>
            )}
          </>
        );
      
      case 'poi':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>, a new{' '}
            <span className="text-cyan-400">
              {discovery.poiType === 'shop' ? 'shop' : 'terminal'}
            </span> in this zone!
          </>
        );
      
      case 'item':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>, a{' '}
            {discovery.rarity && (
              <span className="text-cyan-400">{discovery.rarity}</span>
            )}{' '}
            {discovery.itemType && (
              <span className="text-purple-400">{discovery.itemType}</span>
            )}!
          </>
        );
      
      case 'subnet':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>, 
            a new subnet in the Overnet!
          </>
        );
      
      case 'contact':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>, 
            a new contact!
          </>
        );
      
      case 'district':
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>, 
            a new district in the city!
          </>
        );
      
      default:
        return (
          <>
            You discovered <span className="text-white font-semibold">{discovery.name}</span>!
          </>
        );
    }
  };

  return (
    <div className={`modal-base mb-2 border-2 border-bright-green/50 ${className}`}>
      <div className="modal-title mb-2 text-bright-green">{getTitle()}</div>
      <div className="modal-body-data space-y-2">
        <div className="text-gray-300 text-sm">
          {getDescription()}
        </div>
        {discovery.description && (
          <div className="text-gray-400 text-xs mt-2">
            {discovery.description}
          </div>
        )}
      </div>
    </div>
  );
}
