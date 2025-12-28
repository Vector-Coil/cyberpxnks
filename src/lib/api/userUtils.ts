/**
 * User-related API utilities to eliminate code duplication across routes.
 * 
 * This module provides common user operations like fetching by FID,
 * which is used in virtually every API endpoint.
 * 
 * Usage:
 *   import { getUserByFid } from '~/lib/api/userUtils';
 * 
 *   const user = await getUserByFid(pool, fid);
 *   // User is guaranteed to exist or ApiError is thrown
 */

import { Pool, RowDataPacket } from 'mysql2/promise';
import { ApiError, ApiErrors } from './errors';
import { logger } from '../logger';

/**
 * User row from database
 */
export interface User extends RowDataPacket {
  id: number;
  fid: number;
  username: string;
  mirror_name?: string;
  admin?: boolean | number; // Database may store as TINYINT (number) or BOOLEAN
  pfp_url?: string;
  level?: number;
  xp?: number;
  credits?: number;
  street_cred?: number;
  class_id?: number;
}

/**
 * Get user by Farcaster ID
 * Throws ApiError if user not found
 */
export async function getUserByFid(pool: Pool, fid: number): Promise<User> {
  logger.dbQuery('SELECT user by FID', [fid]);
  
  const [rows] = await pool.execute<User[]>(
    'SELECT id, fid, username, mirror_name, admin, pfp_url, level, xp, credits, street_cred, class_id FROM users WHERE fid = ? LIMIT 1',
    [fid]
  );

  if (rows.length === 0) {
    throw ApiErrors.NotFound('User');
  }

  return rows[0];
}

/**
 * Get user ID by FID (lightweight version when you only need the ID)
 * Throws ApiError if user not found
 */
export async function getUserIdByFid(pool: Pool, fid: number): Promise<number> {
  logger.dbQuery('SELECT user ID by FID', [fid]);
  
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE fid = ? LIMIT 1',
    [fid]
  );

  if (rows.length === 0) {
    throw ApiErrors.NotFound('User');
  }

  return rows[0].id;
}

/**
 * Check if user exists by FID
 */
export async function userExists(pool: Pool, fid: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM users WHERE fid = ? LIMIT 1',
    [fid]
  );

  return rows.length > 0;
}

/**
 * Get user by ID (internal database ID)
 */
export async function getUserById(pool: Pool, userId: number): Promise<User> {
  logger.dbQuery('SELECT user by ID', [userId]);
  
  const [rows] = await pool.execute<User[]>(
    'SELECT id, fid, username, admin, pfp_url, level, xp, credits, street_cred, class_id FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    throw ApiErrors.NotFound('User');
  }

  return rows[0];
}

/**
 * Check if user is admin
 */
export async function isAdmin(pool: Pool, fid: number): Promise<boolean> {
  const user = await getUserByFid(pool, fid);
  return Boolean(user.admin);
}
