"use server";

import { getDbPool, Player } from './db';
import { RowDataPacket } from 'mysql2/promise';

// Define the type for the result explicitly
export type DbCheckResult = {
  success: boolean;
  error?: string;
}

/**
 * Checks the MySQL 'users' table for the given Farcaster FID.
 * This function runs ONLY on the server.
 * @param fid The Farcaster ID to check.
 * @returns A promise that resolves to DbCheckResult.
 */
export async function checkMySQLRegistration(fid: number): Promise<DbCheckResult> {
  console.log(`[SERVER ACTION] Attempting to check MySQL registration for FID: ${fid}`);

  try {
    const pool = await getDbPool();
    
    // Query the database to see if a user with this FID exists
    const [rows] = await pool.execute<Player[] & RowDataPacket[]>(
      'SELECT fid FROM users WHERE fid = ?',
      [fid]
    );

    const isRegistered = rows.length > 0;
    console.log(`[SERVER ACTION] DB Check successful. Registered: ${isRegistered}`);

    return { success: isRegistered };

  } catch (error) {
    // AGGRESSIVE ERROR LOGGING: Log the error on the server and return it to the client
    const errorMessage = `[CRITICAL DB ERROR] The Server Action failed to connect or query MySQL. Error details: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage, error);
    
    return {
      success: false,
      error: errorMessage, // Return the full error message to the client for debugging display
    };
  }
}
