"use client";
import { useState, useEffect } from 'react';
import type { NavData } from '../types/common';

/**
 * Hook to fetch and manage navigation strip data
 * Eliminates duplicate nav data state and fetching across pages
 * @param fid - Farcaster ID (defaults to 300187 for dev)
 * @returns NavData object and loading state
 */
export function useNavData(fid: number = 300187): NavData & { loading: boolean } {
  const [navData, setNavData] = useState<NavData>({
    username: 'user',
    cxBalance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchNavData() {
      try {
        const res = await fetch(`/api/nav-data?fid=${fid}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setNavData(data);
        }
      } catch (err) {
        console.error('Failed to fetch nav data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchNavData();

    return () => {
      mounted = false;
    };
  }, [fid]);

  return { ...navData, loading };
}
