/**
 * Run Combat Stats Migration
 * 
 * This script runs all the necessary SQL migrations to add combat stats to the database:
 * 1. add_combat_stats.sql - Adds columns to user_stats, classes, and creates arsenal_modifiers table
 * 2. populate_class_combat_stats.sql - Sets combat stat values for each class
 * 3. Then runs initializeCombatStats.ts to copy class stats to all existing users
 */

import { getDbPool } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const pool = await getDbPool();
  
  console.log('🚀 Starting Combat Stats Migration...\n');
  
  try {
    // Step 1: Run add_combat_stats.sql
    console.log('Step 1: Adding combat stats columns and tables...');
    const addColumnsSql = fs.readFileSync(
      path.join(__dirname, '../database/add_combat_stats.sql'),
      'utf8'
    );
    
    // Execute the entire SQL file as one statement
    const connection = await pool.getConnection();
    try {
      await connection.query(addColumnsSql);
      console.log('✅ Combat stats columns and tables added\n');
    } finally {
      connection.release();
    }
    
    // Step 2: Run populate_class_combat_stats.sql
    console.log('Step 2: Populating class combat stats...');
    const populateClassSql = fs.readFileSync(
      path.join(__dirname, '../database/populate_class_combat_stats.sql'),
      'utf8'
    );
    
    const connection2 = await pool.getConnection();
    try {
      await connection2.query(populateClassSql);
      console.log('✅ Class combat stats populated\n');
    } finally {
      connection2.release();
    }
    
    // Step 3: Verify class stats
    console.log('Step 3: Verifying class combat stats...');
    const [classRows] = await pool.execute(
      'SELECT class_name, class_tac, class_smt, class_off, class_def, class_evn, class_sth FROM classes'
    );
    console.log('Class combat stats:');
    console.table(classRows);
    console.log();
    
    // Step 4: Initialize user combat stats
    console.log('Step 4: Initializing combat stats for all users...');
    const [users] = await pool.execute<any[]>(
      `SELECT u.id, u.username, c.class_name,
              c.class_tac, c.class_smt, c.class_off, 
              c.class_def, c.class_evn, c.class_sth
       FROM users u
       LEFT JOIN classes c ON u.class_id = c.id`
    );
    
    console.log(`Found ${users.length} users to initialize`);
    
    let updated = 0;
    for (const user of users) {
      await pool.execute(
        `UPDATE user_stats 
         SET base_tac = ?, base_smt = ?, base_off = ?,
             base_def = ?, base_evn = ?, base_sth = ?,
             mod_tac = 0, mod_smt = 0, mod_off = 0,
             mod_def = 0, mod_evn = 0, mod_sth = 0
         WHERE user_id = ?`,
        [
          user.class_tac || 0,
          user.class_smt || 0,
          user.class_off || 0,
          user.class_def || 0,
          user.class_evn || 0,
          user.class_sth || 0,
          user.id
        ]
      );
      updated++;
      
      if (updated % 10 === 0) {
        console.log(`  Initialized ${updated}/${users.length} users...`);
      }
    }
    
    console.log(`✅ Initialized combat stats for ${updated} users\n`);
    
    // Step 5: Verify some user stats
    console.log('Step 5: Verifying user combat stats (first 5 users)...');
    const [userStats] = await pool.execute(
      `SELECT u.username, c.class_name,
              us.base_tac, us.mod_tac,
              us.base_smt, us.mod_smt,
              us.base_off, us.mod_off,
              us.base_def, us.mod_def,
              us.base_evn, us.mod_evn,
              us.base_sth, us.mod_sth
       FROM user_stats us
       JOIN users u ON us.user_id = u.id
       JOIN classes c ON u.class_id = c.id
       LIMIT 5`
    );
    console.log('User combat stats (sample):');
    console.table(userStats);
    
    console.log('\n✨ Combat Stats Migration Complete!');
    console.log('\nNext steps:');
    console.log('1. Test the Stats page to verify combat stats display correctly');
    console.log('2. Add combat stat modifiers to arsenal items in arsenal_modifiers table');
    console.log('3. Test equipping/unequipping arsenal items to verify mod updates');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);
