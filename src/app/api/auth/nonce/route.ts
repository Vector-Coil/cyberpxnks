import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { handleApiError } from '~/lib/api/errors';
import { logger } from '~/lib/logger';

export async function GET() {
  try {
    const client = getNeynarClient();
    const response = await client.fetchNonce();
    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch nonce');
  }
}
