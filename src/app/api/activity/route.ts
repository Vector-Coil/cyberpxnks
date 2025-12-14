import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid, isAdmin } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

interface ActivityRow extends RowDataPacket {
  id: number;
  user_id: number;
  timestamp: Date;
  category: string;
  type: string;
  value: number | null;
  target_id: number | null;
  description: string | null;
  username: string;
  pfp_url: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = validateFid(searchParams.get('fid') || '300187');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const adminMode = searchParams.get('admin') === 'true';

  try {
    const dbPool = await getDbPool();
    let userId: number | null = null;

    // If admin mode, verify user is actually an admin
    if (adminMode) {
      const userIsAdmin = await isAdmin(dbPool, fid);
      if (!userIsAdmin) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
    }

    // If not admin mode, get user ID from FID
    if (!adminMode) {
      userId = await getUserIdByFid(dbPool, fid);
    }

    // Build query
    let query = `
      SELECT 
        al.id,
        al.user_id,
        al.timestamp,
        al.category,
        al.type,
        al.value,
        al.target_id,
        al.description,
        u.username,
        u.pfp_url
      FROM activity_ledger al
      JOIN users u ON al.user_id = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Add user filter if not admin mode
    if (!adminMode && userId) {
      conditions.push('al.user_id = ?');
      params.push(userId);
    }

    // Add category filter if provided
    if (category) {
      conditions.push('al.category = ?');
      params.push(category);
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Order by most recent first
    query += ' ORDER BY al.timestamp DESC';

    // Add limit and offset
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await dbPool.query<ActivityRow[]>(query, params);

    logger.info('Retrieved activity feed', { fid, adminMode, category, count: rows.length, limit, offset });
    return NextResponse.json({
      success: true,
      activities: rows,
      count: rows.length
    });
  } catch (error) {
    return handleApiError(error, '/api/activity');
  }
}
