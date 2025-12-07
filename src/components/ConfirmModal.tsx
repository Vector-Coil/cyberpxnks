'use client';

import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  costInfo?: string[];
  durationInfo?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  title, 
  description,
  costInfo,
  durationInfo,
  onCancel, 
  onConfirm,
  isConfirming = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-charcoal border-2 border-fuschia rounded-lg p-8 max-w-md w-full mx-4 animate-scaleIn">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold uppercase mb-4 text-white">
            {title}
          </h2>
          
          {/* Description */}
          {description && (
            <p className="text-gray-300 mb-4">
              {description}
            </p>
          )}

          {/* Cost Info */}
          {costInfo && costInfo.length > 0 && (
            <div className="space-y-1 mb-2">
              {costInfo.map((cost, index) => (
                <div key={index} className="text-sm text-yellow-400">
                  {cost}
                </div>
              ))}
            </div>
          )}

          {/* Duration Info */}
          {durationInfo && (
            <div className="text-sm text-blue-400">
              {durationInfo}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="btn-cx btn-cx-secondary flex-1"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className="btn-cx btn-cx-primary flex-1"
          >
            {isConfirming ? 'CONFIRMING...' : 'CONFIRM'}
          </button>
        </div>
      </div>
    </div>
  );
}
