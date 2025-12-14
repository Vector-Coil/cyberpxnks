import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { NextResponse } from 'next/server';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fids = searchParams.get('fids');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  if (!fids) {
    return NextResponse.json(
      { error: 'FIDs parameter is required' },
      { status: 400 }
    );
  }

  try {
    const neynar = new NeynarAPIClient({ apiKey });
    const fidsArray = fids.split(',').map(fid => parseInt(fid.trim()));
    
    const { users } = await neynar.fetchBulkUsers({
      fids: fidsArray,
    });

    logger.info('Fetched bulk users from Neynar', { count: users.length, fids: fidsArray });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error, '/api/users');
  }
}
