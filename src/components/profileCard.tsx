// src/components/CustomProfileCard.tsx
'use client';

import React from 'react';

// Define the exact props it expects (your minimal data structure)
interface CustomProfileCardProps {
  fid: number;
  username: string;
  pfpUrl: string | undefined;
}

export function CustomProfileCard({ fid, username, pfpUrl }: CustomProfileCardProps) {

    const finalPfpUrl = pfpUrl || 'https://warpcast.com/~/avatars/default.png';

  return (
    <div className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-80">
      <img 
        src={finalPfpUrl}
        alt={`${username}'s profile picture`}
        className="w-16 h-16 rounded-full"
      />
      <div>
        <h2 className="text-xl font-bold text-gray-10"><a href="http://farcaster.xyz/{username}" target="_blank">@{username}</a></h2>
        <p className="text-sm text-gray-500">FID: {fid}</p>
      </div>
    </div>
  );
}