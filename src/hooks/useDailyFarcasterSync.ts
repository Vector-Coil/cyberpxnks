import { useEffect } from 'react';

/**
 * Hook that syncs user data from Farcaster once per day on first load
 * @param fid - User's Farcaster ID
 */
export function useDailyFarcasterSync(fid: number | null) {
  useEffect(() => {
    if (!fid) return;

    const syncUserData = async () => {
      try {
        const lastSyncKey = `farcaster_sync_${fid}`;
        const lastSync = localStorage.getItem(lastSyncKey);
        
        if (lastSync) {
          const lastSyncTime = new Date(lastSync);
          const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
          
          // Skip if synced within last 24 hours
          if (hoursSinceSync < 24) {
            console.log('Farcaster sync: Already synced today');
            return;
          }
        }

        console.log('Syncing user data from Farcaster...');
        const res = await fetch(`/api/sync-farcaster?fid=${fid}`, {
          method: 'POST'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.synced) {
            console.log('Farcaster sync successful:', data);
            localStorage.setItem(lastSyncKey, new Date().toISOString());
            
            // Optionally reload the page to reflect updated data
            // window.location.reload();
          } else {
            console.log('Farcaster sync skipped:', data.message);
          }
        }
      } catch (err) {
        console.error('Failed to sync Farcaster data:', err);
      }
    };

    syncUserData();
  }, [fid]);
}
