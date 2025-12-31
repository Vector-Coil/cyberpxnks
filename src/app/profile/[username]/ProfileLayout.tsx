'use client';

import React, { useState } from 'react';
import { NavStrip } from '../../../components/CxShared';

interface ProfileLayoutProps {
  username: string;
  profileImage?: string;
  credits: number;
  cxBalance: number;
  userFid: number;
  children: React.ReactNode;
}

export default function ProfileLayout({ username, profileImage, credits, cxBalance, userFid, children }: ProfileLayoutProps) {

  return (
    <>
      <div className="frame-container frame-main">
        <div className="frame-body pt-6 pb-2 px-6 mb-2">
          <NavStrip 
            username={username}
            userProfileImage={profileImage}
            credits={credits}
            cxBalance={cxBalance}
          />
        </div>
        {children}
      </div>
    </>
  );
}
