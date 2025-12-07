// Custom hook for fetching stats with SWR caching
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface StatsData {
  current_consciousness: number;
  current_stamina: number;
  current_charge: number;
  current_bandwidth: number;
  current_thermal: number;
  current_neural: number;
  max_consciousness: number;
  max_stamina: number;
  max_charge: number;
  max_bandwidth: number;
  max_thermal: number;
  max_neural: number;
  clock_speed: number;
  cooling: number;
  // ... other stats
}

/**
 * Hook to fetch user stats with automatic caching and revalidation
 * @param fid - Farcaster ID
 * @param refreshInterval - How often to revalidate (ms), default 15000 (15s)
 */
export function useStats(fid: number, refreshInterval: number = 15000) {
  const { data, error, mutate, isLoading } = useSWR<StatsData>(
    `/api/stats?fid=${fid}`,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false, // Don't refetch when window regains focus
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000
    }
  );

  return {
    stats: data,
    loading: isLoading,
    error,
    refresh: mutate // Manual refresh function
  };
}

/**
 * Hook for nav data with caching
 */
export function useNavDataSWR(fid: number) {
  const { data, error, isLoading } = useSWR(
    `/api/nav-data?fid=${fid}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30s
      revalidateOnFocus: false,
      dedupingInterval: 10000
    }
  );

  return {
    navData: data || { username: 'user', cxBalance: 0 },
    loading: isLoading,
    error
  };
}

/**
 * Hook for alerts with caching
 */
export function useAlertsSWR(fid: number) {
  const { data, error, isLoading } = useSWR(
    `/api/alerts?fid=${fid}`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true, // Do refetch alerts on focus
      dedupingInterval: 30000
    }
  );

  return {
    contacts: data?.contacts || 0,
    gigs: data?.gigs || 0,
    messages: data?.messages || 0,
    loading: isLoading,
    error
  };
}
