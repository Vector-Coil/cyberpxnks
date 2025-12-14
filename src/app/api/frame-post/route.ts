import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Define the public URL of your application (required for redirect)
// **Important**: Change this to your actual Vercel/domain URL when deployed!
const NEXT_PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  if (!NEYNAR_API_KEY) {
    return NextResponse.json(
      { error: 'Neynar API key is not configured.' },
      { status: 500 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey: NEYNAR_API_KEY });
    
    // 1. Get the raw payload from the Farcaster client
    const frameData = await req.json();
    
    // 2. Validate the Frame Action with the Neynar Hub
    const validatedMessage = await neynar.validateFrameAction({
      messageBytesInHex: frameData.trustedData.messageBytes,
    });

    if (!validatedMessage.valid) {
      return NextResponse.json(
        { error: 'Invalid frame action message' },
        { status: 400 }
      );
    }
    
    // 3. Extract the FID of the user who clicked the button
    const fid = validatedMessage.action.interactor.fid;
    
    // 4. Determine the target URL for the web app redirect
    // The redirect path should be your onboarding page with the extracted FID
    const redirectUrl = `${NEXT_PUBLIC_URL}/onboard/1?fid=${fid}`;

    logger.info('Frame action validated, redirecting to onboarding', { fid, redirectUrl });

    // 5. Respond with a 302 redirect. This tells the Farcaster client 
    // to open the specified URL in a new browser window.
    return NextResponse.redirect(redirectUrl, { status: 302 });

  } catch (error) {
    return handleApiError(error, '/api/frame-post');
  }
}