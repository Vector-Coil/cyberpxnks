import { NextResponse } from 'next/server';
import { createClient, Errors } from '@farcaster/quick-auth';
import { requireParams, handleApiError } from '~/lib/api/errors';
import { logger } from '~/lib/logger';

const client = createClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    requireParams(body, ['token']);
    const { token } = body;

    // Get domain from environment or request
    // For Vercel deployments, use the host header
    const host = request.headers.get('host') || 'localhost';
    const domain = process.env.NEXT_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_URL).hostname
      : host.split(':')[0]; // Remove port if present

    logger.debug('Validating token with domain', { domain });

    try {
      // Use the official QuickAuth library to verify the JWT
      const payload = await client.verifyJwt({
        token,
        domain,
      });

      logger.info('Token validated successfully', { fid: payload.sub });

      return NextResponse.json({
        success: true,
        user: {
          fid: payload.sub,
        },
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        logger.warn('Invalid token error', { message: e.message, domain });
        return NextResponse.json({ 
          error: 'Invalid token',
          details: e.message,
          domain: domain 
        }, { status: 401 });
      }
      throw e;
    }
  } catch (error) {
    return handleApiError(error, 'Token validation failed');
  }
}