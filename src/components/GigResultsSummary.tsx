"use client";
import React from 'react';

interface GrantedItem { id: number; name: string }

interface UnlockedGig { id: number; gig_code?: string }

interface Props {
  credits: number;
  items: GrantedItem[];
  unlockedGigs: UnlockedGig[];
  onClose?: () => void;
}

export default function GigResultsSummary({ credits, items, unlockedGigs, onClose }: Props) {
  return (
    <div className="modal-base mb-2">
      <div className="modal-title mb-2 text-bright-green">GIG COMPLETE</div>
      <div className="modal-body-data space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Credits</span>
          <span className="pill-cloud-gray">{credits ?? 0} Credits</span>
        </div>

        {items && items.length > 0 && (
          <div>
            <div className="text-gray-300">Items</div>
            <div className="mt-1 space-y-1">
              {items.map((it) => (
                <div key={it.id} className="pill-cloud-gray text-sm inline-block mr-2 mb-1">{it.name}</div>
              ))}
            </div>
          </div>
        )}

        {unlockedGigs && unlockedGigs.length > 0 && (
          <div>
            <div className="text-gray-300">Unlocked</div>
            <div className="mt-1 space-y-1">
              {unlockedGigs.map((g) => (
                <div key={g.id} className="pill-cloud-gray text-sm inline-block mr-2 mb-1">{g.gig_code ?? `Gig ${g.id}`}</div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button className="btn-cx btn-cx-primary" onClick={() => onClose && onClose()}>Close</button>
        </div>
      </div>
    </div>
  );
}
