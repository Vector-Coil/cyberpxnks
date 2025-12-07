// src/components/NeynarProvider.tsx
'use client'; 
import React from 'react';
import { NeynarContextProvider, Theme } from '@neynar/react';

// Make sure this is defined in your .env.local as NEXT_PUBLIC_NEYNAR_CLIENT_ID
const CLIENT_ID = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || '';

export default function NeynarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NeynarContextProvider settings={{ 
        clientId: CLIENT_ID,
        defaultTheme: Theme.Dark, // Choose your theme
    }}>
      {children}
    </NeynarContextProvider>
  );
}