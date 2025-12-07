// --- src/app/onboard/page.tsx (Styled Frame Viewer) ---

import React from 'react';
import Link from 'next/link';
import '~/app/globals.css'; // Assuming this is linked in your main layout

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
} */

export default function Landing() {
  return (
    <div className="landing-container">
      <h1>CYBERPXNKS</h1>
      <Link href="/onboard/1">
        <button className="btn-primary">
          Connect to CX
        </button>
      </Link>
    </div>
  );
}