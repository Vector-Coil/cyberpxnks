import { redirect } from 'next/navigation';
import { getDbPool } from '../../lib/db';

export default async function ProfileRedirect() {
  // For now, redirect to test user profile (fid 300187)
  // TODO: Replace with actual logged-in user detection
  try {
    const pool = await getDbPool();
    const [userRows] = await pool.execute<any[]>(
      'SELECT username FROM users WHERE fid = ? LIMIT 1',
      [300187]
    );
    const user = (userRows as any[])[0];
    
    if (user && user.username) {
      redirect(`/profile/${user.username}`);
    } else {
      // Fallback to default username
      redirect('/profile/anticrash');
    }
  } catch (err) {
    console.error('Profile redirect error:', err);
    // Fallback to default username
    redirect('/profile/anticrash');
  }
}
