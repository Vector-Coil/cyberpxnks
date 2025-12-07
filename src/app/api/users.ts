import { getDbPool } from '../../lib/db'; // Adjust path as necessary
import { Player } from '../../lib/db'; // Assuming Player is defined for the users table rows
import type { NextApiRequest, NextApiResponse } from 'next';
import { RowDataPacket } from 'mysql2/promise';

// Define the expected structure for the data returned by the API
interface UserApiResponse extends Player, RowDataPacket {
    id: number;
    username: string;
    farcaster_fid: number;
    status: string;
    // pfp_url is often a separate lookup or stored, but we'll include it here
    pfp_url: string; 
}

/**
 * API handler to fetch all users from the MySQL 'users' table.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const pool = await getDbPool();
        
        // SQL query to fetch the essential user data
        // NOTE: If pfp_url is in a separate table, you would JOIN here.
        // Assuming it is directly on the 'users' table for simplicity.
        const query = `
            SELECT id, username, farcaster_fid, status, pfp_url 
            FROM users 
            ORDER BY username ASC
        `;

        console.log("DB: Executing query to fetch all users.");
        
        // Execute the query
        // The type assertion ensures TypeScript recognizes the returned rows
        const [rows] = await pool.execute<UserApiResponse[]>(query);

        if (rows.length === 0) {
            console.warn("DB: Query returned no users.");
        }

        // Send the fetched data back to the client
        res.status(200).json(rows);

    } catch (error) {
        console.error("Server-side database query failed:", error);
        // Do not expose sensitive error details to the client
        res.status(500).json({ message: 'Internal Server Error during database operation.' });
    }
}