import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';

// Helper function to resolve requirement names
async function resolveRequirementName(req: string, pool: any): Promise<string> {
  if (!req || !req.trim()) return '';
  
  const parts = req.split('_');
  if (parts.length !== 2) return req;
  
  const type = parts[0];
  const idNum = parseInt(parts[1], 10);
  try {
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

    if (sort === 'contact') {
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
        WHERE (gh.status = 'UNLOCKED' OR gh.status = 'STARTED' OR gh.status = 'IN PROGRESS' OR gh.last_completed_at IS NOT NULL)
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
        WHERE (gh.status = 'UNLOCKED' OR gh.status = 'STARTED' OR gh.status = 'IN PROGRESS' OR gh.last_completed_at IS NOT NULL)
        ORDER BY g.id DESC
        LIMIT 100
      `;
      params = [userId];
    }

    const [rows] = await pool.execute(query, params);
    console.debug('[API /api/gigs] Query returned rows count:', Array.isArray(rows) ? (rows as any[]).length : 0);
    // Resolve requirement and objective names for all gigs
    const gigsWithResolvedReqs = await Promise.all(
      (rows as any[]).map(async (gig) => {
        try {
          const reqNames: Array<string | null> = [];
          for (let i = 1; i <= 5; i++) {
            const key = `req_${i}`;
            try {
              reqNames.push(gig[key] ? await resolveRequirementName(gig[key], pool) : null);
            } catch (reqErr) {
              console.error('[API /api/gigs] Failed to resolve requirement', { gigId: gig.id, key, error: reqErr });
              reqNames.push(gig[key] || null);
            }
          }
          const [req_1_name, req_2_name, req_3_name, req_4_name, req_5_name] = reqNames;

          // Parse objectives: column names vary (obj_1, obj1, objective_1, etc.)
          const objectives: string[] = [];
          const objectiveKeys = Object.keys(gig || {}).filter(k => /(^obj\b|^obj_|^objective|^objective_|^obj\d|obj_\d)/i.test(k)).slice(0, 5);
          // Normalize to up to 3 objectives
          for (const key of objectiveKeys) {
            if (objectives.length >= 3) break;
            const rawVal = gig[key];
            if (!rawVal) continue;
            try {
              const resolved = await resolveRequirementName(rawVal, pool);
              objectives.push(resolved);
            } catch (innerErr) {
              console.error('[API /api/gigs] Failed to resolve objective', { gigId: gig.id, key, value: rawVal, error: innerErr });
              objectives.push(String(rawVal));
            }
          }

          // Determine effective status: if a gig was previously completed, re-check
          // its requirements against the user's current state and downgrade if needed.
          let effectiveStatus = gig.status;
          try {
            const completedAt = gig.last_completed_at;
            if (completedAt) {
              // Re-check all requirements (any unmet requirement should invalidate completion)
              let allStillMet = true;
              for (let i = 1; i <= 5; i++) {
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
                } else if (type === 'gig') {
                  const [rows] = await pool.execute('SELECT 1 FROM gig_history WHERE user_id = ? AND gig_id = ? AND (status = \'complete\' OR status = \'completed\') LIMIT 1', [userId, idNum]);
                  if (!(rows as any[]).length) { allStillMet = false; break; }
                } else if (type === 'item') {
                  const [rows] = await pool.execute('SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ? LIMIT 1', [userId, idNum]);
                  const inv = (rows as any[])[0];
                  if (!inv || Number(inv.quantity) <= 0) { allStillMet = false; break; }
                } else {
                  allStillMet = false; break;
                }
              }
              if (!allStillMet) {
                // Downgrade completed gigs to 'in progress' so UI reflects that requirements
                // are no longer satisfied (user removed required item, etc.). If the row
                // already reports a started/in-progress status, keep it.
                const s = String(gig.status || '').toLowerCase();
                if (!s || s === 'completed' || s === 'complete') {
                  effectiveStatus = 'IN PROGRESS';
                } else {
                  effectiveStatus = gig.status;
                }
              }
            }
          } catch (statusCheckErr) {
            console.error('[API /api/gigs] Error re-checking completed gig requirements', { gigId: gig.id, error: statusCheckErr });
          }

          return {
            ...gig,
            status: effectiveStatus,
            req_1_name,
            req_2_name,
            req_3_name,
            req_4_name,
            req_5_name,
            objectives
          };
        } catch (err) {
          console.error('[API /api/gigs] Error resolving gig requirements', { gig, error: err });
          // Return the gig with minimal info so the whole endpoint doesn't fail
          return {
            ...gig,
            req_1_name: gig.req_1 || null,
            req_2_name: gig.req_2 || null,
            req_3_name: gig.req_3 || null,
            req_4_name: gig.req_4 || null,
            req_5_name: gig.req_5 || null,
            objectives: []
          };
        }
      })
    );

    return NextResponse.json({ 
      gigs: gigsWithResolvedReqs,
      sort 
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    return NextResponse.json({ error: 'Failed to fetch gigs' }, { status: 500 });
  }
}
