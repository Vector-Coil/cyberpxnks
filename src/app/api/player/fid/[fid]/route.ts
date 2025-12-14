// app/api/player/[fid]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, Player } from '~/lib/db'; // Adjust path if needed
import { FieldPacket } from 'mysql2/promise';
import { handleApiError } from '~/lib/api/errors';
import { logger } from '~/lib/logger';

/**
 * API route to fetch a player's state by Farcaster ID (fid).
 * @param req The NextRequest object.
 * @param context Context containing dynamic route parameters.
 */

export async function GET(
  request: NextRequest, 
  // Accessing the 'fid' parameter from the 'params' object
  { params }: { params: Promise<{ fid: string }> } 
) {
  const resolvedParams = await params;
  const fid = resolvedParams.fid;

  if (!fid) {
    return NextResponse.json({ error: 'Missing Farcaster ID (FID)' }, { status: 400 });
  }

// Convert the fid from string (URL param) to a number for the database
  const fidNum = parseInt(fid);
  if (isNaN(fidNum)) {
      return NextResponse.json({ error: 'Invalid Farcaster ID format' }, { status: 400 });
  }

  // 1. Get the connection pool
  let pool;
  try {
    pool = await getDbPool();
  } catch (error) {
    return handleApiError(error, 'Database connection failed');
  }

  // 2. Query the database
  try {
    const query = 'SELECT * FROM users WHERE fid = ?';
    // The pool.execute() method is safer against SQL injection
    const [rows, fields]: [Player[], FieldPacket[]] = await pool.execute<Player[]>(query, [fid]);

    const player = rows[0];

    if (!player) {
      // Player does not exist, which will trigger our "initialize" flow later
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // 3. Return the player data
    return NextResponse.json(player, { status: 200 });

  } catch (error) {
    return handleApiError(error, 'Database query failed');
  }
}