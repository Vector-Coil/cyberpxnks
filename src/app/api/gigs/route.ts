import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

function normalizeStatus(raw: any): string {
  if (!raw && raw !== 0) return '';
  const s = String(raw).trim().toLowerCase();
  if (!s) return '';
  if (s === 'completed' || s === 'complete') return 'COMPLETED';
  if (s === 'started' || s === 'start') return 'STARTED';
  if (s === 'unlocked') return 'UNLOCKED';
  if (s === 'in_progress' || s === 'inprogress' || s === 'in progress') return 'IN PROGRESS';
  if (s === 'locked') return 'LOCKED';
  return String(raw).toUpperCase();
}

// Helper function to resolve requirement names
async function resolveRequirementName(req: string, pool: any): Promise<string> {
  if (!req || !req.trim()) return '';
  
  const parts = req.split('_');
  if (parts.length !== 2) return req;
  
  const type = parts[0];
  const idNum = parseInt(parts[1], 10);
  try {
    console.time('[API /api/gigs] total processing time');
    if (type === 'gig' && idNum) {
      const [rows] = await pool.execute('SELECT gig_code FROM gigs WHERE id = ? LIMIT 1', [idNum]);
      const gig = (rows as any[])[0];
      return gig?.gig_code ? `GIG: ${gig.gig_code}` : req;
    } else if (type === 'contact' && idNum) {
      const [rows] = await pool.execute('SELECT display_name FROM contacts WHERE id = ? LIMIT 1', [idNum]);
      const contact = (rows as any[])[0];
      return contact?.display_name || req;
    } else if (type === 'item' && idNum) {
      const [rows] = await pool.execute('SELECT name FROM items WHERE id = ? LIMIT 1', [idNum]);
      const item = (rows as any[])[0];
      return item?.name || req;
    }
  } catch (e) {
    console.error('Error resolving requirement:', e);
  }

  return req;

}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get('fid');
  const sort = searchParams.get('sort') || 'newest';

  if (!fid) {
    return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
  }

  const pool = await getDbPool();

  try {
    // Get user ID
    const [userRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE fid = ? LIMIT 1',
      [fid]
    );
    
    if (!userRows.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userId = userRows[0].id;

    // Query gigs with user's history
    let query, params;

    // Support a 'completed' filter to list only completed gigs
    if (sort === 'completed') {
      query = `
        SELECT
          g.id, g.gig_code as title, g.gig_desc as description,
          g.reward_item, g.reward_credits, g.contact,
          c.display_name as contact_name,
          c.image_url as contact_image_url,
          g.image_url,
          gr.req_1, gr.req_2, gr.req_3, gr.req_4, gr.req_5,
          gr.*,
          gh.status,
          gh.last_completed_at,
          gh.completed_count,
          gh.unlocked_at
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_history gh ON g.id = gh.gig_id AND gh.user_id = ?
        LEFT JOIN contacts c ON g.contact = c.id
        WHERE (gh.last_completed_at IS NOT NULL OR LOWER(gh.status) IN ('completed','complete'))
        ORDER BY gh.last_completed_at DESC, g.id DESC
        LIMIT 100
      `;
      params = [userId];
    } else if (sort === 'contact') {
      // Sort by contact - show gigs from unlocked contacts
      query = `
        SELECT 
          g.id, g.gig_code as title, g.gig_desc as description,
          g.reward_item, g.reward_credits, g.contact,
          c.display_name as contact_name,
          c.image_url as contact_image_url,
          g.image_url,
          gr.req_1, gr.req_2, gr.req_3,
          -- Grab full requirements row; objective column names may vary
          gr.*,
          gh.status,
          gh.last_completed_at,
          gh.completed_count,
          gh.unlocked_at
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_history gh ON g.id = gh.gig_id AND gh.user_id = ?
        LEFT JOIN contacts c ON g.contact = c.id
        ORDER BY g.contact, g.id DESC
      `;
      params = [userId];
    } else {
      // Default - show all unlocked gigs for this user
      query = `
        SELECT 
          g.id, g.gig_code as title, g.gig_desc as description,
          g.reward_item, g.reward_credits, g.contact,
          c.display_name as contact_name,
          c.image_url as contact_image_url,
          g.image_url,
          gr.req_1, gr.req_2, gr.req_3, gr.req_4, gr.req_5,
          -- Grab full requirements row; objective column names may vary
          gr.*,
          gh.status,
          gh.last_completed_at,
          gh.completed_count,
          gh.unlocked_at
        FROM gigs g
        LEFT JOIN gig_requirements gr ON g.id = gr.gig_id
        LEFT JOIN gig_history gh ON g.id = gh.gig_id AND gh.user_id = ?
        LEFT JOIN contacts c ON g.contact = c.id
        WHERE (gh.unlocked_at IS NOT NULL OR gh.status IS NOT NULL OR gh.last_completed_at IS NOT NULL)
        ORDER BY g.id DESC
        LIMIT 100
      `;
      params = [userId];
    }

    const [rows] = await pool.execute(query, params);
    console.debug('[API /api/gigs] Query returned rows count:', Array.isArray(rows) ? (rows as any[]).length : 0);
    // Resolve requirement and objective names for gigs with a time-bound loop
    const startTime = Date.now();
    const timeLimitMs = 2000; // If processing takes longer than this, return partial results
    const gigsWithResolvedReqs: any[] = [];
    let timedOut = false;

    for (const gig of (rows as any[])) {
      // If we've exceeded the time budget, stop resolving further and return partial
      if (Date.now() - startTime > timeLimitMs) {
        console.warn('[API /api/gigs] Processing time exceeded, returning partial results');
        timedOut = true;
        break;
      }

      try {
        // Resolve requirement display names (req_1..req_5)
        const req_1_name = gig.req_1 ? await resolveRequirementName(String(gig.req_1), pool) : null;
        const req_2_name = gig.req_2 ? await resolveRequirementName(String(gig.req_2), pool) : null;
        const req_3_name = gig.req_3 ? await resolveRequirementName(String(gig.req_3), pool) : null;
        const req_4_name = gig.req_4 ? await resolveRequirementName(String(gig.req_4), pool) : null;
        const req_5_name = gig.req_5 ? await resolveRequirementName(String(gig.req_5), pool) : null;

        // Parse objective_* or obj_* columns into readable objective names (limited)
        const objectives: string[] = [];
        try {
          const candidateKeys = Object.keys(gig).filter(k => /^objective[_\d]*|^obj[_\d]*/i.test(k));
          for (const key of candidateKeys) {
            const rawVal = gig[key];
            if (!rawVal) continue;
            try {
              const resolved = await resolveRequirementName(String(rawVal), pool);
              if (!objectives.includes(resolved)) objectives.push(resolved);
            } catch (innerErr) {
              console.error('[API /api/gigs] Failed to resolve objective', { gigId: gig.id, key, value: rawVal, error: innerErr });
              objectives.push(String(rawVal));
            }
          }
        } catch (e) {
          console.error('[API /api/gigs] Error parsing objectives', { gigId: gig.id, error: e });
        }

        // Determine effective status (best-effort). Keep heavy re-checks minimal.
        let effectiveStatus = normalizeStatus(gig.status || null);

        try {
          const completedAt = gig.last_completed_at;
          if (completedAt) {
            // Light-weight re-check: only verify contact requirements quickly
            let allStillMet = true;
            for (let i = 1; i <= 3; i++) {
              const r = gig[`req_${i}`];
              if (!r) continue;
              const parts = String(r).split('_');
              if (parts.length !== 2) { allStillMet = false; break; }
              const [type, idStr] = parts;
              const idNum = parseInt(idStr, 10);
              if (!type || !idNum) { allStillMet = false; break; }
              if (type === 'contact') {
                const [rows] = await pool.execute('SELECT 1 FROM contact_history WHERE user_id = ? AND contact_id = ? AND status = \'unlocked\' LIMIT 1', [userId, idNum]);
                if (!(rows as any[]).length) { allStillMet = false; break; }
              }
            }
            if (!allStillMet) {
              const s = String(gig.status || '').toLowerCase();
              if (!s || s === 'completed' || s === 'complete') {
                effectiveStatus = 'IN PROGRESS';
              } else {
                effectiveStatus = normalizeStatus(gig.status);
              }
            }
          }
        } catch (statusCheckErr) {
          console.error('[API /api/gigs] Error re-checking completed gig requirements', { gigId: gig.id, error: statusCheckErr });
        }

        // Best-effort implicit unlock check (light-weight, limited)
        try {
          const hasHistory = gig && (gig.status !== null && gig.status !== undefined && String(gig.status).trim() !== '');
          if (!hasHistory) {
            let allMet = true;
            for (let i = 1; i <= 2; i++) {
              const r = gig[`req_${i}`];
              if (!r) continue;
              const parts = String(r).split('_');
              if (parts.length !== 2) { allMet = false; break; }
              const [type, idStr] = parts;
              const idNum = parseInt(idStr, 10);
              if (!type || !idNum) { allMet = false; break; }
              if (type === 'contact') {
                const [rows] = await pool.execute('SELECT 1 FROM contact_history WHERE user_id = ? AND contact_id = ? AND status = \'unlocked\' LIMIT 1', [userId, idNum]);
                if (!(rows as any[]).length) { allMet = false; break; }
              }
            }
            if (allMet) {
              effectiveStatus = 'UNLOCKED';
            }
          }
        } catch (e) {
          console.error('[API /api/gigs] Error checking implicit unlock for gig', { gigId: gig.id, error: e });
        }

        gigsWithResolvedReqs.push({
          ...gig,
          status: normalizeStatus(effectiveStatus),
          req_1_name,
          req_2_name,
          req_3_name,
          req_4_name,
          req_5_name,
          objectives
        });
      } catch (err) {
        console.error('[API /api/gigs] Error resolving gig requirements', { gig, error: err });
        gigsWithResolvedReqs.push({
          ...gig,
          req_1_name: gig.req_1 || null,
          req_2_name: gig.req_2 || null,
          req_3_name: gig.req_3 || null,
          req_4_name: gig.req_4 || null,
          req_5_name: gig.req_5 || null,
          objectives: []
        });
      }
    }
    console.timeEnd('[API /api/gigs] total processing time');

    

    // Filter gigs to include only unlocked/started/in-progress or completed gigs
    let filteredGigs = gigsWithResolvedReqs;
    if (sort === 'completed') {
      filteredGigs = gigsWithResolvedReqs.filter(g => {
        const s = String(g.status || '').toUpperCase();
        return s === 'COMPLETED' || g.last_completed_at;
      });
    } else {
      filteredGigs = gigsWithResolvedReqs.filter(g => {
        const s = String(g.status || '').toUpperCase();
        return s === 'UNLOCKED' || s === 'IN PROGRESS' || s === 'STARTED' || s === 'COMPLETED' || g.last_completed_at;
      });
    }

    // Default ordering: push IN PROGRESS (started) to top, UNLOCKED next, COMPLETED to bottom
    // Only apply this reordering for the default 'newest' sort and 'contact' view should keep grouping
    let finalGigs = filteredGigs;
    if (sort === 'newest') {
      const priority = (s: string) => {
        const ss = String(s || '').toUpperCase();
        if (ss === 'IN PROGRESS' || ss === 'STARTED') return 0;
        if (ss === 'UNLOCKED') return 1;
        if (ss === 'COMPLETED') return 2;
        return 1;
      };
      finalGigs = filteredGigs.slice().sort((a: any, b: any) => {
        const pa = priority(a.status);
        const pb = priority(b.status);
        if (pa !== pb) return pa - pb;
        return Number(b.id || 0) - Number(a.id || 0);
      });
    }

    return NextResponse.json({ 
      gigs: finalGigs,
      sort 
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    return NextResponse.json({ error: 'Failed to fetch gigs' }, { status: 500 });
  }
}
