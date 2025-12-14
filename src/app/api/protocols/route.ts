import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { validateFid } from '~/lib/api/errors';
import { getUserIdByFid } from '~/lib/api/userUtils';
import { logger } from '~/lib/logger';
import { handleApiError } from '~/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = validateFid(searchParams.get('fid') || '300187');
    const pool = await getDbPool();
    const userId = await getUserIdByFid(pool, fid);

    // Fetch protocols the user has access to
    // For now, showing all protocols - will add access checks based on reputation/gigs later
    const [protocolRows] = await pool.execute<any[]>(
      `SELECT 
        p.id,
        p.name,
        p.controlling_alignment_id,
        p.description,
        p.access_rep_id,
        p.access_gig_id,
        p.image_url,
        a.name as alignment_name
       FROM protocols p
       LEFT JOIN alignments a ON p.controlling_alignment_id = a.id
       ORDER BY p.name`,
      []
    );

    // TODO: Filter protocols based on user's completed gigs and reputation levels
    // For now, return all protocols as placeholders

    logger.info('Retrieved protocols', { fid, count: protocolRows.length });
    return NextResponse.json(protocolRows);
  } catch (err: any) {
    return handleApiError(err, '/api/protocols');
  }
}
