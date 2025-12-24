'use client';

import React, { useState } from 'react';
import { NavStrip } from '../../../components/CxShared';
import NavDrawer from '../../../components/NavDrawer';

interface ProfileLayoutProps {
  username: string;
  profileImage?: string;
  credits: number;
  cxBalance: number;
  userFid: number;
  children: React.ReactNode;
}

export default function ProfileLayout({ username, profileImage, credits, cxBalance, userFid, children }: ProfileLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <NavDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        username={username}
        profileImage={profileImage}
        cxBalance={cxBalance}
        userFid={userFid}
      />
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6 mb-2">
          <NavStrip 
            username={username}
            userProfileImage={profileImage}
            credits={credits}
            cxBalance={cxBalance}
            onMenuClick={() => setIsDrawerOpen(true)}
          />
        </div>
        {children}
      </div>
    </>
  );
}
