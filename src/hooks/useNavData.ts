"use client";
import { useState, useEffect } from 'react';
import type { NavData } from '../types/common';
import { useCxTokenBalance } from './useCxTokenBalance';

/**
 * Hook to fetch and manage navigation strip data
 * Combines database credits with on-chain $CX token balance
 * @param fid - Farcaster ID (defaults to 300187 for dev)
 * @returns NavData object with loading state, credits, and token balance
 */
export function useNavData(fid: number = 300187): NavData & { loading: boolean } {
  const [navData, setNavData] = useState<NavData>({
    username: 'user',
    credits: 0,
    cxBalance: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Fetch $CX token balance from connected wallet
  const { balance: tokenBalance, isLoading: isTokenLoading } = useCxTokenBalance();

  useEffect(() => {
    let mounted = true;

    async function fetchNavData() {
      try {
        const res = await fetch(`/api/nav-data?fid=${fid}`);
        if (res.ok && mounted) {
          const data = await res.json();
          setNavData(prev => ({
            ...data,
            cxBalance: tokenBalance // Add token balance from wallet
          }));
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
  }, [fid, tokenBalance]);

  return { ...navData, loading };
}
