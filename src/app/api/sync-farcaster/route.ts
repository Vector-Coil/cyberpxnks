import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid } from '~/lib/api/errors';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid'));

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    const dbPool = await getDbPool();

    // Check when user was last synced
    const [userRows] = await dbPool.query<RowDataPacket[]>(
      'SELECT id, last_farcaster_sync FROM users WHERE fid = ?',
      [fid]
    );

    if (userRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userRows[0];
    const lastSync = user.last_farcaster_sync ? new Date(user.last_farcaster_sync) : null;
    const now = new Date();

    // Check if already synced today
    if (lastSync) {
      const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync < 24) {
        return NextResponse.json({ 
          synced: false, 
          message: 'Already synced today',
          lastSync: lastSync 
        });
      }
    }

    // Fetch latest data from Farcaster via Neynar
    const neynar = new NeynarAPIClient({ apiKey });
    const { users } = await neynar.fetchBulkUsers({
      fids: [parseInt(fid)],
    });

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found on Farcaster' }, { status: 404 });
    }

    const farcasterUser = users[0];

    // Update user data
    await dbPool.query(
      `UPDATE users 
       SET username = ?, 
           pfp_url = ?, 
           last_farcaster_sync = UTC_TIMESTAMP() 
       WHERE id = ?`,
      [farcasterUser.username, farcasterUser.pfp_url, user.id]
    );

    logger.info('Synced Farcaster data', { fid, username: farcasterUser.username });
    return NextResponse.json({
      synced: true,
      message: 'User data synced successfully',
      username: farcasterUser.username,
      pfp_url: farcasterUser.pfp_url,
      syncedAt: now
    });
  } catch (error) {
    return handleApiError(error, '/api/sync-farcaster');
  }
}
