"use client";
import React from 'react';
import { FrameHeader, CxCard, TopNav } from '../../components/CxShared';

export default function TerminalsPage() {
  return (
    <div className="frame-container frame-main">
      <FrameHeader />
      <div className="frame-body">
        <TopNav />
        <CxCard title="Terminals">
          <div className="p-4 text-gray-300">Terminals page — spawn or use terminals here.</div>
        </CxCard>
      </div>
    </div>
  );
}
