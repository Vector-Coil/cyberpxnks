"use client";
import React from 'react';
import type { Encounter } from './EncounterAlert';

interface ActionDismissButtonsProps {
  encounter?: Encounter | null;
  onDismiss: () => void;
  onOpenEncounter?: (encounterId: number) => void;
  className?: string;
  dismissLabel?: string;
  encounterLabel?: string;
}

/**
 * Unified component for action dismiss/completion buttons.
 * Handles two states:
 * 1. No encounter: Single "DISMISS" button
 * 2. Has encounter: "OPEN ENCOUNTER" + "RUN AWAY (DISMISS)" buttons
 * 
 * Used by all action result displays for consistent UX.
 */
export function ActionDismissButtons({
  encounter,
  onDismiss,
  onOpenEncounter,
  className = '',
  dismissLabel = 'DISMISS',
  encounterLabel = 'OPEN ENCOUNTER'
}: ActionDismissButtonsProps) {
  const handleOpenEncounter = () => {
    if (encounter && onOpenEncounter) {
      onOpenEncounter(encounter.id);
    } else if (encounter) {
      // Fallback to direct navigation if handler not provided
      window.location.href = `/encounters/${encounter.id}`;
    }
  };

  if (encounter) {
    return (
      <div className={`space-y-2 ${className}`}>
        <button 
          className="btn-cx btn-cx-primary btn-cx-full"
          onClick={handleOpenEncounter}
        >
          {encounterLabel}
        </button>
        <button 
          className="btn-cx btn-cx-secondary btn-cx-full"
          onClick={onDismiss}
        >
          RUN AWAY (DISMISS)
        </button>
      </div>
    );
  }

  return (
    <button 
      className={`btn-cx btn-cx-secondary btn-cx-full ${className}`}
      onClick={onDismiss}
    >
      {dismissLabel}
    </button>
  );
}
