/**
 * Test Combat Stats Query
 * Quick script to verify combat stats are being returned correctly
 */

import { getDbPool } from '../src/lib/db';
import { StatsService } from '../src/lib/statsService';

async function test() {
  const pool = await getDbPool();
  
  try {
    // Get first user
    const [users] = await pool.execute<any[]>(
      'SELECT id, username, fid FROM users LIMIT 1'
    );
    
    if (users.length === 0) {
      console.log('No users found');
      return;
    }
    
    const user = users[0];
    console.log(`\nTesting combat stats for user: ${user.username} (ID: ${user.id})\n`);
    
    // Get stats using StatsService
    const service = new StatsService(pool, user.id);
    const stats = await service.getStats();
    
    console.log('Combat Stats from API:');
    console.log('---------------------');
    console.log(`Tactical: base=${stats.base_tac}, mod=${stats.mod_tac}, total=${stats.tactical}`);
    console.log(`Smart Tech: base=${stats.base_smt}, mod=${stats.mod_smt}, total=${stats.smart_tech}`);
    console.log(`Offense: base=${stats.base_off}, mod=${stats.mod_off}, total=${stats.offense}`);
    console.log(`Defense: base=${stats.base_def}, mod=${stats.mod_def}, total=${stats.defense}`);
    console.log(`Evasion: base=${stats.base_evn}, mod=${stats.mod_evn}, total=${stats.evasion}`);
    console.log(`Stealth: base=${stats.base_sth}, mod=${stats.mod_sth}, total=${stats.stealth}`);
    
    // Also check raw DB values
    console.log('\n\nRaw DB values:');
    console.log('-------------');
    const [rawStats] = await pool.execute(
      `SELECT base_tac, mod_tac, base_smt, mod_smt, base_off, mod_off,
              base_def, mod_def, base_evn, mod_evn, base_sth, mod_sth
       FROM user_stats WHERE user_id = ?`,
      [user.id]
    );
    console.table(rawStats);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

test();
