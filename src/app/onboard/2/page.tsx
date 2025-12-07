// --- src/app/onboard/page.tsx (Styled Frame Viewer) ---
"use client";

import React from 'react';
import Link from 'next/link';
import '~/app/globals.css'; // Assuming this is linked in your main layout

export default function Landing() {

  return (
    <div className="landing-container">
      <h1>Connecting...</h1>
      <div> welcome so and so </div>
      <div> (avatar)</div>

      <Link href="/onboard/3">
        <button className="btn-primary">
          Set your stats
        </button>
      </Link>
    </div>
  );
}