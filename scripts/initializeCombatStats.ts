/**
 * Initialize Combat Stats for Existing Users
 * 
 * This script copies combat stat values from each user's class to their user_stats record.
 * Run this after executing the add_combat_stats.sql migration and updating class combat stats.
 */

import { getDbPool } from '~/lib/db';

async function initializeCombatStats() {
  const pool = await getDbPool();
  
  try {
    console.log('Starting combat stats initialization...');
    
    // Get all users with their class information
    const [users] = await pool.execute(`
      SELECT u.id, u.class_id, 
             c.class_tac, c.class_smt, c.class_off, 
             c.class_def, c.class_evn, c.class_sth
      FROM users u
      INNER JOIN classes c ON u.class_id = c.id
    `);
    
    const userList = users as any[];
    console.log(`Found ${userList.length} users to initialize`);
    
    let updated = 0;
    let failed = 0;
    
    // Update each user's combat stats
    for (const user of userList) {
      try {
        await pool.execute(`
          UPDATE user_stats
          SET base_tac = ?,
              base_smt = ?,
              base_off = ?,
              base_def = ?,
              base_evn = ?,
              base_sth = ?
          WHERE user_id = ?
        `, [
          user.class_tac,
          user.class_smt,
          user.class_off,
          user.class_def,
          user.class_evn,
          user.class_sth,
          user.id
        ]);
        
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`Progress: ${updated}/${userList.length} users updated`);
        }
      } catch (err) {
        console.error(`Failed to update user ${user.id}:`, err);
        failed++;
      }
    }
    
    console.log('\n=== Combat Stats Initialization Complete ===');
    console.log(`Successfully updated: ${updated} users`);
    console.log(`Failed: ${failed} users`);
    
    if (failed === 0) {
      console.log('All users initialized successfully!');
    }
    
  } catch (err) {
    console.error('Error during initialization:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run the initialization
initializeCombatStats()
  .then(() => {
    console.log('\nInitialization script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nInitialization script failed:', err);
    process.exit(1);
  });
