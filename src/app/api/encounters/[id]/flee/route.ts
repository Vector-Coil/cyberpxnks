import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, logActivity } from '../../../../../lib/db';
import { RowDataPacket } from 'mysql2/promise';
import { StatsService } from '../../../../../lib/statsService';

// Penalties for running away
const FLEE_PENALTIES = {
  streetCred: -5,
  charge: -15,
  stamina: -10,
  neural: 5
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const encounterId = parseInt(id, 10);
    
    if (isNaN(encounterId)) {
      return NextResponse.json({ error: 'Invalid encounter ID' }, { status: 400 });
    }

    const body = await request.json();
    const { fid } = body;

    if (!fid) {
      return NextResponse.json({ error: 'FID is required' }, { status: 400 });
    }

    const pool = await getDbPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get user with lock
      const [userRows] = await connection.query<RowDataPacket[]>(
        `SELECT id, street_cred FROM users WHERE fid = ? FOR UPDATE`,
        [fid]
      );

      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userRows[0];

      // Get encounter details for logging
      const [encounterRows] = await connection.query<RowDataPacket[]>(
        `SELECT name, encounter_type, zone_id, context FROM encounters WHERE id = ? LIMIT 1`,
        [encounterId]
      );

      const encounter = encounterRows.length > 0 ? encounterRows[0] : null;

      // Apply street cred penalty
      await connection.query(
        `UPDATE users SET street_cred = street_cred + ? WHERE id = ?`,
        [FLEE_PENALTIES.streetCred, user.id]
      );

      // Apply resource penalties
      const statsService = new StatsService(connection as any, user.id);
      await statsService.modifyStats({
        charge: FLEE_PENALTIES.charge,
        stamina: FLEE_PENALTIES.stamina,
        neural: FLEE_PENALTIES.neural
      });

      // Log flee action
      await logActivity(
        user.id,
        'encounter',
        'fled',
        0,
        encounterId,
        `Fled from encounter: ${encounter?.name || 'Unknown'}`
      );

      await connection.commit();
      connection.release();

      return NextResponse.json({
        success: true,
        fled: true,
        penalties: {
          streetCred: FLEE_PENALTIES.streetCred,
          charge: FLEE_PENALTIES.charge,
          stamina: FLEE_PENALTIES.stamina,
          neural: FLEE_PENALTIES.neural
        },
        message: 'You fled from the encounter, suffering penalties.'
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err: any) {
    console.error('Encounter flee API error:', err);
    return NextResponse.json(
      { error: 'Failed to flee encounter', details: err.message },
      { status: 500 }
    );
  }
}
