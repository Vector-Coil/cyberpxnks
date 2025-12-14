import { NextResponse } from 'next/server';
import { getNeynarClient } from '~/lib/neynar';
import { handleApiError } from '~/lib/api/errors';
import { logger } from '~/lib/logger';

export async function POST() {
  try {
    const neynarClient = getNeynarClient();
    const signer = await neynarClient.createSigner();
    return NextResponse.json(signer);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch signer');
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const signerUuid = searchParams.get('signerUuid');

  if (!signerUuid) {
    return NextResponse.json(
      { error: 'signerUuid is required' },
      { status: 400 }
    );
  }

  try {
    const neynarClient = getNeynarClient();
    const signer = await neynarClient.lookupSigner({
      signerUuid,
    });
    return NextResponse.json(signer);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch signed key');
  }
}
