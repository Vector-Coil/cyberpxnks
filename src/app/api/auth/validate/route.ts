import { NextResponse } from 'next/server';
import { createClient, Errors } from '@farcaster/quick-auth';

const client = createClient();

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get domain from environment or request
    // For Vercel deployments, use the host header
    const host = request.headers.get('host') || 'localhost';
    const domain = process.env.NEXT_PUBLIC_URL
      ? new URL(process.env.NEXT_PUBLIC_URL).hostname
      : host.split(':')[0]; // Remove port if present

    console.log('Validating token with domain:', domain);

    try {
      // Use the official QuickAuth library to verify the JWT
      const payload = await client.verifyJwt({
        token,
        domain,
      });

      console.log('Token validated successfully for FID:', payload.sub);

      return NextResponse.json({
        success: true,
        user: {
          fid: payload.sub,
        },
      });
    } catch (e) {
      if (e instanceof Errors.InvalidTokenError) {
        console.error('Invalid token error:', e.message, 'Domain used:', domain);
        return NextResponse.json({ 
          error: 'Invalid token',
          details: e.message,
          domain: domain 
        }, { status: 401 });
      }
      throw e;
    }
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}