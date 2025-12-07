import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const pool = await getDbPool();

    // Get user ID from FID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    const user = (userRows as any[])[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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

    return NextResponse.json(protocolRows);
  } catch (err: any) {
    console.error('Protocols API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch protocols' },
      { status: 500 }
    );
  }
}
