import { NextRequest, NextResponse } from 'next/server';
import { getNavStripData } from '../../../lib/navUtils';
import { validateFid } from '~/lib/api/errors';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');

    const data = await getNavStripData(fid);
    logger.info('Retrieved nav data', { fid });
    return NextResponse.json(data);
  } catch (err: any) {
    return handleApiError(err, '/api/nav-data');
  }
}
