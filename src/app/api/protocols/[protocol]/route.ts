import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ protocol: string }> }
) {
  try {
    const { protocol: protocolIdParam } = await params;
    const protocolId = parseInt(protocolIdParam, 10);
    
    if (isNaN(protocolId)) {
      return NextResponse.json({ error: 'Invalid protocol ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Verify user has access to this protocol
    const [accessRows] = await pool.execute<any[]>(
      `SELECT upa.unlocked_at, upa.unlock_method
       FROM user_protocol_access upa
       WHERE upa.user_id = ? AND upa.protocol_id = ?`,
      [userId, protocolId]
    );

    if (accessRows.length === 0) {
      return NextResponse.json({ error: 'Protocol not unlocked' }, { status: 403 });
    }

    // Get protocol details with subnet info
    const [protocolRows] = await pool.execute<any[]>(
      `SELECT 
        p.id,
        p.name,
        p.controlling_alignment_id,
        p.description,
        p.access_rep_id,
        p.access_gig_id,
        p.image_url,
        p.subnet_id,
        a.name as alignment_name,
        s.name as subnet_name
       FROM protocols p
       LEFT JOIN alignments a ON p.controlling_alignment_id = a.id
       LEFT JOIN subnets s ON p.subnet_id = s.id
       WHERE p.id = ?
       LIMIT 1`,
      [protocolId]
    );

    if (protocolRows.length === 0) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 });
    }

    const protocol = protocolRows[0];

    // Get user's protocol activity history
    const [historyRows] = await pool.execute<any[]>(
      `SELECT 
        id, 
        action_type, 
        timestamp, 
        end_time, 
        result_status, 
        gains_data, 
        xp_data
       FROM user_protocol_history
       WHERE user_id = ? AND protocol_id = ?
       ORDER BY timestamp DESC
       LIMIT 20`,
      [userId, protocolId]
    );

    // Get all users' activity in this protocol for "all activity" view
    const [allHistoryRows] = await pool.execute<any[]>(
      `SELECT 
        uph.id,
        uph.action_type,
        uph.timestamp,
        u.username
       FROM user_protocol_history uph
       INNER JOIN users u ON uph.user_id = u.id
       WHERE uph.protocol_id = ?
       ORDER BY uph.timestamp DESC
       LIMIT 50`,
      [protocolId]
    );

    // Format all history messages
    const allHistory = allHistoryRows.map((row: any) => {
      const alias = row.username;
      let message = `[${alias}] performed ${row.action_type} on ${protocol.name}`;
      
      return {
        id: row.id,
        message,
        timestamp: row.timestamp,
        action_type: row.action_type
      };
    });

    logger.info('Retrieved protocol details', { fid, protocolId });
    
    return NextResponse.json({
      protocol,
      history: historyRows,
      allHistory,
      access: accessRows[0]
    });
  } catch (err: any) {
    console.error('Protocol API error:', err);
    logger.error('Protocol API error', { error: err.message, stack: err.stack });
    return handleApiError(err, '/api/protocols/[protocol]');
  }
}
