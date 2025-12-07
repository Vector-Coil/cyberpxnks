// --- src/app/onboard/1/page.tsx (Conceptual Client Component) ---

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// import '~/app/globals.css'; // Assuming this is linked in your main layout

interface FarcasterUserData {
    fid: number;
    username: string;
    displayName: string;
    avatarUrl: string;
}

export default function OnboardDetailsPage() {
    const searchParams = useSearchParams();
    // const [userData, setUserData] = useState(null);
    const [userData, setUserData] = useState<FarcasterUserData | null>(null);
    const fid = searchParams.get('fid'); // Read FID from the URL

    useEffect(() => {
        if (fid) {
            const fetchUserData = async () => {
                // *** CALLING YOUR EXISTING API ROUTE: /api/users ***
                const response = await fetch(`/api/users?fids=${fid}`);
                const data = await response.json();

                if (response.ok && data.users && data.users.length > 0) {
                    // Extract the first user from the bulk response array
                    const user = data.users[0]; 
                    
                    setUserData({
                        fid: user.fid,
                        username: user.username,
                        displayName: user.displayName,
                        avatarUrl: user.pfp_url, // Note the underscore if using Neynar V2 API naming
                    });
                } else {
                    console.error("User data not found or API error:", data.error);
                    setUserData(null); // Handle error state
                }
            };
            fetchUserData();
        }
    }, [fid]);

    if (!userData) {
        return <div>Loading Farcaster data...</div>;
    }

    return (
        <div className="p-8">
            <h2>Welcome, {userData.username}!</h2>
            <div className="flex items-center space-x-4 mb-8">
                <img 
                    src={userData.avatarUrl} 
                    alt="Avatar" 
                    className="w-12 h-12 rounded-full"
                />
                <p>FID: **{fid}**</p>
            </div>
            
            {/* Next Link to continue the flow and initiate record creation */}
            <Link href={`/onboard/2?fid=${fid}`} passHref>
                <button 
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => {
                        // TODO: Implement the logic to push the user record to MySQL
                        // This can be done via a Server Action or a dedicated API route
                        console.log(`User ${fid} record initiated in MySQL.`);
                    }}
                >
                    Start Character Creation
                </button>
            </Link>
        </div>
    );
}

// Base URL for the Frame API routes
/*
const FRAME_BASE_URL = '/app/onboard/1'; 

export default function OnboardViewerPage() {
  return (
    // You can apply custom styling and layout here using Tailwind/CSS modules
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="bg-gray-900">
        
        <iframe
          src={FRAME_BASE_URL} // Points to your route.ts handler
          title="CX Onboarding"
          width="424"
          height="695"
          frameBorder="0" // Remove iframe border
          className="scrollbar-hid sizeFull flex-1 opacity-100"
        />

      </div>
    </div>
  );
} 

export default function Landing() {
  return (
    <div className="landing-container">
      <h1>Getting Started</h1>
      <Link href="/onboard/2">
        <button className="btn-primary">
          Connect Farcaster
        </button>
      </Link>
    </div>
  );
} */