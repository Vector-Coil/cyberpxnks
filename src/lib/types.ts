// --- /lib/types.ts ---

/**
 * Defines the structure for the data returned after user creation.
 */
export interface UserData {
    success: boolean;
    reason?: string; // Only present if success is false
    id?: number;
    username?: string;
    farcaster_fid?: number;
    pfp_url?: string;
}

/**
 * Defines the structure for a single Competency attached to a Class.
 */
export interface CompetencyData {
    name: string;
    description: string;
    icon_url: string;
}

/**
 * Defines the structure for a single Class, including its linked competencies.
 */
export interface ClassData {
    id: number;
    name: string;
    description: string;
    image_url: string;
    // e.g., { INTERFACE: 2, POWER: -1 }
    attribute_bonuses: Record<string, number>; 
    competencies: CompetencyData[];
}