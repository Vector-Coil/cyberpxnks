// --- lib/db.ts (Corrected and Consolidated) ---

import mysql, { Pool, RowDataPacket } from 'mysql2/promise';
// import { UserData, ClassData } from './types'; 

// Dummy types for imports used in original file to avoid errors
// In a real project, these would come from './types'
export interface UserData {
    success: boolean;
    reason?: string;
    id?: number;
    username?: string;
    farcaster_fid?: number;
    pfp_url?: string;
    last_farcaster_sync?: Date;
}
export interface ClassData {
    id: number;
    name: string;
    description: string;
    image_url: string;
    attribute_bonuses: { [key: string]: number };
    competencies: { name: string; description: string; icon_url: string }[];
}

// NOTE: It is critical to reuse the connection pool in serverless environments.
// We use a global variable to ensure the pool is initialized only once.
declare global {
  // eslint-disable-next-line no-var
  var dbPool: Pool | undefined;
}

// Configuration from environment variables
// IMPORTANT: The dotenv package must be configured *before* this file is imported
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Optional: Type definition for a player row
export interface Player extends RowDataPacket {
  id: number;
  username: string;
  fid: number;
  status: string;
  initialized: Date;
}

// === NEW INTERFACES FOR USER STATS ===

// Defines the shape of the data pulled directly from the user_stats table
// Note: Max values are now calculated dynamically by StatsService, not stored in DB
export interface UserStatsData {
    user_id: number;
    current_consciousness: number;
    current_stamina: number;
    current_charge: number;
    current_bandwidth: number;
    current_thermal: number;
    current_neural: number;
    base_clock: number;
    mod_clock: number;
    total_clock: number;
    base_cooling: number;
    mod_cooling: number;
    total_cooling: number;
    base_signal: number;
    mod_signal: number;
    total_signal: number;
    base_latency: number;
    mod_latency: number;
    total_latency: number;
    base_crypt: number;
    mod_crypt: number;
    total_crypt: number;
    base_cache: number;
    mod_cache: number;
    total_cache: number;
    last_regeneration?: Date;
}
// Database row type combining the data structure with RowDataPacket
export interface UserStatsRow extends UserStatsData, RowDataPacket {}

// =====================================


/**
 * Initializes and returns a singleton MySQL connection pool.
 * @returns {Promise<Pool>} The MySQL connection pool instance.
 */
export async function getDbPool(): Promise<Pool> {
  // Use the existing pool if it's already defined
  if (global.dbPool) {
    return global.dbPool;
  }

  // Create the new pool and store it globally
  global.dbPool = mysql.createPool(config);
  console.log("Database connection pool initialized.");

  return global.dbPool;
}

// === NEW FUNCTION TO FETCH USER STATS ===
/**
 * Fetches all user stats from the database based on the Farcaster FID.
 * Assumes 'user_stats.user_id' links to 'users.id'.
 * @param {number} fid - The Farcaster ID of the user.
 * @returns {Promise<UserStatsData | null>} The user's stat data, or null if not found.
 */
export async function getUserStatsByFid(fid: number): Promise<UserStatsData | null> {
    try {
        const pool = await getDbPool();

        // Query joins 'users' to 'user_stats' to find the stats by farcaster_fid
        const query = `
            SELECT us.* FROM user_stats us
            JOIN users u ON us.user_id = u.id
            WHERE u.fid = ?
        `;

        console.log(`DB: Fetching user stats for FID: ${fid}`);
        
        const [rows] = await pool.execute<UserStatsRow[]>(query, [fid]);

        if (rows.length === 0) {
            console.warn(`DB: No stats found for FID: ${fid}`);
            return null;
        }

        // Return the first (and should be only) row of stats
        return rows[0];

    } catch (error) {
        console.error("Database error in getUserStatsByFid:", error);
        return null;
    }
}
// =====================================

export function getInitialFrame(): { image_url: string, text: string } {
    // This is the mock data for Frame 1
    return {
        image_url: '/images/frame1.png', // Ensure this image path is correct
        text: 'Welcome to Night City, Cyberpunk. Begin your journey.',
    };
}

export function getFrame2Data(): { image_url: string, text: string } {
    return {
        image_url: '/images/frame2.png',
        text: 'Frame 2: Understanding the Cyberpxnks faction system.',
    };
}

export function getFrame3Data(): { image_url: string, text: string } {
    return {
        image_url: '/images/frame3.png',
        text: 'Frame 3: The dangers of the Outskirts and why you are here.',
    };
}

export function getFrame4Data(): { image_url: string, text: string } {
    return {
        image_url: '/images/frame4.png',
        text: 'Frame 4: Final checks before choosing your specialization.',
    };
}

/**
 * Mocks the retrieval of all available classes for the onboard frame.
 * @returns {Promise<ClassData[]>} A promise that resolves to an array of class data.
 */
export async function getAllClasses(): Promise<ClassData[]> {
    console.log("DB: Fetching mock class data for selection frame.");

    // Mock Class Data for Frame 5 Carousel
    const classes: ClassData[] = [
        {
            id: 1,
            name: "Street Samurai",
            description: "A close-quarters brute. High damage, low stealth. Masters of chrome blades.",
            image_url: "/classes/samurai.png",
            attribute_bonuses: { "POWER": 3, "SPEED": -1, "INTERFACE": -1 },
            competencies: [
                { name: "Blade Mastery", description: "High damage with swords.", icon_url: "" },
                { name: "Heavy Chrome", description: "Can wear power armor.", icon_url: "" }
            ]
        },
        {
            id: 2,
            name: "Netrunner",
            description: "A digital phantom. Weak physically, terrifying in cyberspace. The eyes of the team.",
            image_url: "/classes/netrunner.png",
            attribute_bonuses: { "POWER": -2, "SPEED": 1, "INTERFACE": 4 },
            competencies: [
                { name: "Data Jacking", description: "Can bypass security systems.", icon_url: "" },
                { name: "Code Fluency", description: "Increased interface effectiveness.", icon_url: "" }
            ]
        },
        {
            id: 3,
            name: "Nomad",
            description: "A scavenger and mechanic. Balanced stats, excels in resourcefulness and driving.",
            image_url: "/classes/nomad.png",
            attribute_bonuses: { "POWER": 1, "SPEED": 2, "INTERFACE": 0 },
            competencies: [
                { name: "Repair Tech", description: "Fixes equipment efficiently.", icon_url: "" },
                { name: "Terrain Mastery", description: "Movement bonus in rough areas.", icon_url: "" }
            ]
        }
    ];

    return classes;
}

// --- Updated createUser function (Ready for Database Implementation) ---
/**
 * Creates a new user record in the database.
 * NOTE: This is currently a mock and needs to be updated to use the pool.
 */
export async function createUser(fid: number, username: string, pfp_url: string): Promise<UserData> {
  try {
    const pool = await getDbPool();

    // 1. Check if user already exists
    const [rows] = await pool.execute<Player[]>(
      'SELECT id, username FROM users WHERE farcaster_fid = ?',
      [fid]
    );

    if (rows.length > 0) {
      // User exists, return success: false (or redirect them if necessary)
      return { success: false, reason: 'User already created.' };
    }

    // 2. Perform the Database INSERT operation
    console.log(`DB: Creating new user FID:${fid}, Username:${username}`);

    const [result] = await pool.execute(
      `INSERT INTO users (farcaster_fid, username, pfp_url, unallocated_points, status)
       VALUES (?, ?, ?, 9, 'CREATING')`,
      [fid, username, pfp_url]
    );

    // This part depends on how you defined UserData, assuming it returns the new ID
    return {
      success: true,
      id: (result as any).insertId, // Get the ID of the new row
      username: username,
      farcaster_fid: fid,
      pfp_url: pfp_url
    };

  } catch (error) {
    console.error("Database error in createUser:", error);
    return { success: false, reason: 'Database write failed.' };
  }
}

// =====================================
// Activity Ledger Functions
// =====================================

export interface ActivityLogEntry {
  user_id: number;
  timestamp: Date;
  category: string;
  type: string;
  value?: number | null;
  target_id?: number | null;
  description?: string | null;
}

/**
 * Log an activity to the activity_ledger table
 * @param userId - The user performing the activity
 * @param category - High-level category (action, discovery, encounter, status, social, progression, economy, gear, system)
 * @param type - Specific activity type (e.g., scout_started, zone_discovered, level_up)
 * @param value - Optional numeric value (XP amount, CX spent, duration, etc.)
 * @param targetId - Optional ID of related entity (zone_id, item_id, user_id, etc.)
 * @param description - Optional human-readable description or JSON data
 */
export async function logActivity(
  userId: number,
  category: string,
  type: string,
  value?: number | null,
  targetId?: number | null,
  description?: string | null
): Promise<boolean> {
  try {
    const pool = await getDbPool();
    
    await pool.execute(
      `INSERT INTO activity_ledger 
       (user_id, timestamp, category, type, value, target_id, description) 
       VALUES (?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?)`,
      [userId, category, type, value ?? null, targetId ?? null, description ?? null]
    );
    
    console.log(`Activity logged: ${category}/${type} for user ${userId}`);
    return true;
  } catch (error) {
    console.error("Error logging activity:", error);
    return false;
  }
}