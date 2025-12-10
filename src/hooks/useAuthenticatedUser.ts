import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { useNeynarContext } from '@neynar/react';

/**
 * Hook to get the authenticated user's FID from either SDK context or Neynar
 * Redirects to landing page if no authentication found
 */
export function useAuthenticatedUser() {
  const router = useRouter();
  const { user: neynarUser } = useNeynarContext();
  const [userFid, setUserFid] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getAuthenticatedFid = async () => {
      try {
        // Try SDK context first (mini-app)
        try {
          const context = await sdk.context;
          if (context?.user?.fid) {
            setUserFid(context.user.fid);
            setIsLoading(false);
            return;
          }
        } catch (sdkError) {
          console.log('No SDK context available');
        }

        // Try Neynar context (web)
        if (neynarUser?.fid) {
          setUserFid(neynarUser.fid);
          setIsLoading(false);
          return;
        }

        // No authentication found - redirect to landing
        console.log('No authenticated user found, redirecting to landing');
        router.push('/');
      } catch (error) {
        console.error('Error getting authenticated FID:', error);
        router.push('/');
      }
    };

    getAuthenticatedFid();
  }, [neynarUser, router]);

  return { userFid, isLoading };
}
