"use client";
import React from 'react';

export interface Encounter {
  id: number;
  name: string;
  type: string;
  sentiment: 'attack' | 'hostile' | 'neutral' | 'friendly';
  sentimentColor?: string;
}

interface EncounterAlertProps {
  encounter: Encounter;
  className?: string;
}

/**
 * Unified component for displaying encounter warnings.
 * Shows consistent encounter information with sentiment-based styling.
 * 
 * Sentiments:
 * - attack: Immediate hostile action (red)
 * - hostile: Aggressive but not attacking yet (orange)
 * - neutral: Uncertain intentions (yellow)
 * - friendly: Positive intentions (green)
 */
export function EncounterAlert({ encounter, className = '' }: EncounterAlertProps) {
  const getSentimentColor = () => {
    switch (encounter.sentiment) {
      case 'attack':
        return 'text-red-500';
      case 'hostile':
        return 'text-orange-500';
      case 'neutral':
        return 'text-yellow-400';
      case 'friendly':
        return 'text-green-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className={`modal-base mb-2 border-2 border-yellow-500/50 ${className}`}>
      <div className="modal-title mb-2 text-yellow-400">⚠ ENCOUNTER DETECTED</div>
      <div className="modal-body-data space-y-2">
        <div className="text-gray-300 text-sm">
          You've encountered <span className="text-white font-semibold">{encounter.name}</span>, 
          a <span className="text-cyan-400">{encounter.type}</span> with{' '}
          <span className={`font-semibold ${getSentimentColor()}`}>
            {encounter.sentiment}
          </span> intentions.
        </div>
      </div>
    </div>
  );
}
