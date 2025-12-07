'use client';

import React from 'react';

interface LevelUpModalProps {
  isOpen: boolean;
  newLevel: number;
  onDismiss: () => void;
}

export default function LevelUpModal({ isOpen, newLevel, onDismiss }: LevelUpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-charcoal border-2 border-fuschia rounded-lg p-8 max-w-md w-full mx-4 animate-scaleIn">
        {/* Level Up Text */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold uppercase mb-4" style={{ color: 'var(--fuschia)' }}>
            LEVEL UP
          </h2>
          
          {/* Large Level Number */}
          <div className="text-9xl font-bold mb-4" style={{ color: 'var(--fuschia)' }}>
            {newLevel}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="btn-cx btn-cx-primary w-full"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}
