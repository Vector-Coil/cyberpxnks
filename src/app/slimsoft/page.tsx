"use client";
import React from 'react';
import { FrameHeader, CxCard, TopNav } from '../../components/CxShared';

export default function SlimsoftPage() {
  return (
    <div className="frame-container frame-main">
      <FrameHeader />
      <div className="frame-body">
        <TopNav />
        <CxCard title="Slimsoft">
          <div className="p-4 text-gray-300">Slimsoft page — manage your installed slimsoft modules here.</div>
        </CxCard>
      </div>
    </div>
  );
}
