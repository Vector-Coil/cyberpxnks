"use client";
import { useEffect } from 'react';

export function AutoRegeneration() {
  useEffect(() => {
    const regenerate = async () => {
      try {
        const res = await fetch('/api/regenerate?fid=300187', {
          method: 'POST'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.intervalsElapsed > 0) {
            console.log(`Auto-regenerated ${data.intervalsElapsed} intervals (${data.intervalsElapsed * 15} minutes)`);
          }
        }
      } catch (err) {
        console.error('Auto-regeneration failed:', err);
      }
    };

    // Run immediately on mount
    regenerate();
    
    // Then run every 15 minutes
    const interval = setInterval(regenerate, 900000); // 15 minutes = 900000ms
    
    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything
  return null;
}
