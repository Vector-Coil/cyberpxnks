import { generateFrame } from '~/lib/frameUtils';
import { getFrame3Data } from '~/lib/db'; 
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const data = getFrame3Data(); 
    const postTarget = '/app/onboard/4'; // Posts to Frame 4

    const frame = generateFrame(
        data.image_url,
        data.text,
        [{ label: 'Continue', action: 'post' }],
        postTarget
    );
    return NextResponse.json(frame); 
}

export async function POST(req: NextRequest) {
    return NextResponse.redirect(new URL('/app/onboard/4', req.url), 302);
}