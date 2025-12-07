// --- In src/app/onboard/1/route.ts (UPDATE THIS FILE) ---

import { getInitialFrame } from '~/lib/db'; 
import { getFrameHtml } from '~/lib/frameUtils'; // Import the new function
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const data = getInitialFrame(); 
    const postTarget = '/app/onboard/2'; 

    const frameMetadata = {
        version: 'vNext',
        image: data.image_url,
        postUrl: postTarget,
        buttons: [{ label: 'Start Onboarding', action: 'post' }],
    };

    // 1. Generate the HTML string
    const html = getFrameHtml(frameMetadata); 

    // 2. Return the HTML response with the CRITICAL header
    return new NextResponse(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html', // This tells the iframe to render HTML
        },
    });
}

// NOTE: You must also update the POST handler here and in frames 2, 3, 4!
// For /app/onboard/1, the POST handler should simply redirect to /app/onboard/2.
export async function POST(req: NextRequest) {
    return NextResponse.redirect(new URL('/app/onboard/2', req.url), 302);
}