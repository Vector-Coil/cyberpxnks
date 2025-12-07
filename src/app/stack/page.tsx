"use client";
import React from 'react';
import { FrameHeader, CxCard, TopNav } from '../../components/CxShared';

export default function StackPage() {
  return (
    <div className="frame-container frame-main">
      <FrameHeader />
      <div className="frame-body">
        <TopNav />
        <CxCard title="Stack">
          <div className="p-4 text-gray-300">Stack page — view your software/hardware stack here.</div>
        </CxCard>
      </div>
    </div>
  );
}
