"use client";
import React from 'react';
import NavDrawer from '~/components/NavDrawer';
import { useDrawer } from '~/contexts/DrawerContext';
import { useAuthenticatedUser } from '~/hooks/useAuthenticatedUser';
import { useNavData } from '~/hooks/useNavData';

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const { isOpen, closeDrawer } = useDrawer();
  const { userFid } = useAuthenticatedUser();
  const navData = useNavData(userFid || 0);

  return (
    <>
      <NavDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        username={navData.username}
        profileImage={navData.profileImage}
        cxBalance={navData.cxBalance}
        userFid={userFid || undefined}
      />
      {children}
    </>
  );
}
