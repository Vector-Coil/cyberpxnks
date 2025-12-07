"use client";
import React from 'react';
import { FrameHeader, CxCard, TopNav } from '../../components/CxShared';

export default function MessagesPage() {
  return (
    <div className="frame-container frame-main">
      <FrameHeader />
      <div className="frame-body">
        <TopNav />
        <CxCard title="Messages">
          <div className="p-4 text-gray-300">Messages page — your messages and threads appear here.</div>
        </CxCard>
      </div>
    </div>
  );
}
