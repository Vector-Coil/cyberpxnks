import { NextRequest, NextResponse } from 'next/server';
import { getNavStripData } from '../../../lib/navUtils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get('fid');
    const fid = fidParam ? parseInt(fidParam, 10) : 300187;

    if (Number.isNaN(fid)) {
      return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
    }

    const data = await getNavStripData(fid);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('nav-data API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch nav data' },
      { status: 500 }
    );
  }
}
