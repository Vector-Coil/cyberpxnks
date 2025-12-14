import { NextResponse } from 'next/server';
import { validateFid } from '~/lib/api/errors';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: Request) {
  const apiKey = process.env.NEYNAR_API_KEY;
  const { searchParams } = new URL(request.url);
  const fid = validateFid(searchParams.get('fid'));
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Neynar API key is not configured. Please add NEYNAR_API_KEY to your environment variables.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/best_friends?fid=${fid}&limit=3`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.statusText}`);
    }

    const { users } = await response.json() as { users: { user: { fid: number; username: string } }[] };

    logger.info('Retrieved best friends', { fid, count: users.length });
    return NextResponse.json({ bestFriends: users });
  } catch (error) {
    return handleApiError(error, '/api/best-friends');
  }
} 