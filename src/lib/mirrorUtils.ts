import { Pool } from 'mysql2/promise';
import { logger } from './logger';

const MIRROR_ADJECTIVES = [
  // Core cyberpunk
  'shadow', 'ghost', 'phantom', 'echo', 'void', 'cipher', 'neon', 
  'cyber', 'glitch', 'hex', 'byte', 'zero', 'null', 'dark', 'rogue',
  'chrome', 'synth', 'razor', 'pulse', 'neural', 'nano', 'quantum',
  // Sci-fi adjacent
  'stellar', 'cosmic', 'nexus', 'vector', 'matrix', 'nexus', 'flux',
  'photon', 'plasma', 'ion', 'fusion', 'warp', 'singularity', 'vertex',
  'prism', 'signal', 'beacon', 'orbit', 'vortex', 'enigma', 'paradox',
  'anomaly', 'fractal', 'hologram', 'specter', 'wraith', 'replicant'
];

const MIRROR_SUFFIXES = [
  // Numeric prefixes
  '0x', '1x', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x',
  // Greek letters
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 
  'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  // Greek deities
  'zeus', 'athena', 'apollo', 'artemis', 'ares', 'hades', 'hermes',
  'hera', 'poseidon', 'hephaestus', 'dionysus', 'demeter',
  // Roman deities
  'mars', 'venus', 'jupiter', 'neptune', 'mercury', 'pluto', 'vulcan',
  'minerva', 'juno', 'diana', 'ceres', 'vesta',
  // Egyptian deities
  'ra', 'anubis', 'osiris', 'isis', 'horus', 'thoth', 'set', 'bastet',
  'sobek', 'ptah', 'sekhmet', 'nephthys',
  // Sumerian deities
  'enki', 'enlil', 'inanna', 'anu', 'utu', 'nanna', 'ereshkigal',
  'marduk', 'tiamat', 'nergal', 'ninurta',
  // Phonetic alphabet
  'echo', 'foxtrot', 'tango', 'whiskey', 'bravo', 'charlie', 'yankee',
  'zulu', 'victor', 'sierra', 'romeo', 'kilo', 'lima', 'oscar',
  // Star names
  'sirius', 'vega', 'rigel', 'betelgeuse', 'altair', 'deneb', 'antares',
  'polaris', 'spica', 'arcturus', 'canopus', 'aldebaran', 'capella',
  // Technical/scientific/mathematical
  'quark', 'boson', 'fermion', 'neutrino', 'hadron', 'lepton', 'photon',
  'tensor', 'vector', 'scalar', 'matrix', 'vertex', 'apex', 'zenith',
  'nexus', 'codec', 'cipher', 'protocol', 'kernel', 'daemon', 'proxy',
  'node', 'mesh', 'relay', 'shard', 'cache', 'buffer', 'stack'
];

/**
 * Generates a random mirror name in the format: adjective_suffix
 * Example: shadow_7x9k, ghost_3m2p, cipher_alpha
 */
function generateMirrorName(): string {
  const adjective = MIRROR_ADJECTIVES[Math.floor(Math.random() * MIRROR_ADJECTIVES.length)];
  const suffix = MIRROR_SUFFIXES[Math.floor(Math.random() * MIRROR_SUFFIXES.length)];
  const randomChars = Math.random().toString(36).substring(2, 6); // 4 random alphanumeric chars
  return `${adjective}_${suffix}${randomChars}`;
}

/**
 * Generates a unique mirror name by checking against existing mirror_name values in users table
 * @param pool - MySQL connection pool
 * @returns A unique mirror_name string
 */
export async function generateUniqueMirrorName(pool: Pool): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const mirrorName = generateMirrorName();
    
    // Check if this mirror_name already exists
    const [existingRows] = await pool.execute<any[]>(
      'SELECT id FROM users WHERE mirror_name = ? LIMIT 1',
      [mirrorName]
    );

    if (existingRows.length === 0) {
      logger.info('Generated unique mirror_name', { mirrorName, attempts: attempts + 1 });
      return mirrorName;
    }

    attempts++;
  }

  // Fallback: append timestamp if we couldn't find a unique name after max attempts
  const fallbackName = `${generateMirrorName()}_${Date.now().toString(36)}`;
  logger.warn('Using fallback mirror_name with timestamp', { fallbackName });
  return fallbackName;
}

/**
 * Checks if a user has the Mirror slimsoft (item_id = 68) equipped
 * @param pool - MySQL connection pool
 * @param userId - The user's ID
 * @returns true if Mirror is equipped, false otherwise
 */
export async function isMirrorEquipped(pool: Pool, userId: number): Promise<boolean> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT ul.id 
       FROM user_loadout ul
       WHERE ul.user_id = ? 
       AND ul.item_id = 68 
       AND ul.slot_type = 'slimsoft'
       LIMIT 1`,
      [userId]
    );

    const isEquipped = rows.length > 0;
    logger.debug('Checked Mirror equipped status', { userId, isEquipped });
    return isEquipped;
  } catch (err) {
    logger.error('Error checking Mirror equipped status', { userId, error: err });
    return false;
  }
}

/**
 * Gets the appropriate display name for a user based on whether Mirror is equipped
 * @param pool - MySQL connection pool
 * @param userId - The user's ID
 * @param username - The user's regular username
 * @param mirrorName - The user's mirror_name
 * @returns The username to display (mirror_name if Mirror equipped, username otherwise)
 */
export async function getDisplayName(
  pool: Pool, 
  userId: number, 
  username: string, 
  mirrorName: string | null
): Promise<string> {
  const mirrorEquipped = await isMirrorEquipped(pool, userId);
  
  if (mirrorEquipped && mirrorName) {
    return mirrorName;
  }
  
  return username || 'Unknown';
}
