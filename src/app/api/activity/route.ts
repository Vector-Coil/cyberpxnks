import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';

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
  const fid = searchParams.get('fid');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const adminMode = searchParams.get('admin') === 'true';

  try {
    const dbPool = await getDbPool();

    let userId: number | null = null;

    // If admin mode, verify user is actually an admin
    if (adminMode) {
      if (!fid) {
        return NextResponse.json({ error: 'FID is required for admin mode' }, { status: 400 });
      }

      const [adminRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT admin FROM users WHERE fid = ?',
        [fid]
      );

      if (adminRows.length === 0 || !adminRows[0].admin) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
    }

    // If not admin mode, get user ID from FID
    if (!adminMode) {
      if (!fid) {
        return NextResponse.json({ error: 'FID is required' }, { status: 400 });
      }

      const [userRows] = await dbPool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE fid = ?',
        [fid]
      );

      if (userRows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      userId = userRows[0].id;
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

    return NextResponse.json({
      success: true,
      activities: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: 'Failed to fetch activities', 
      details: errorMessage 
    }, { status: 500 });
  }
}
