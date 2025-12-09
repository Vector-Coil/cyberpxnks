'use client';

import { useState, useEffect, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Represents the current authenticated user state
 */
interface AuthenticatedUser {
  /** The user's Farcaster ID (FID) */
  fid: number;
}

/**
 * Possible authentication states for QuickAuth
 */
type QuickAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Return type for the useQuickAuth hook
 */
interface UseQuickAuthReturn {
  /** Current authenticated user data, or null if not authenticated */
  authenticatedUser: AuthenticatedUser | null;
  /** Current authentication status */
  status: QuickAuthStatus;
  /** Function to initiate the sign-in process using QuickAuth */
  signIn: () => Promise<boolean>;
  /** Function to sign out and clear the current authentication state */
  signOut: () => Promise<void>;
  /** Function to retrieve the current authentication token */
  getToken: () => Promise<string | null>;
}

/**
 * Custom hook for managing QuickAuth authentication state
 *
 * This hook provides a complete authentication flow using Farcaster's QuickAuth:
 * - Automatically checks for existing authentication on mount
 * - Validates tokens with the server-side API
 * - Manages authentication state in memory (no persistence)
 * - Provides sign-in/sign-out functionality
 *
 * QuickAuth tokens are managed in memory only, so signing out of the Farcaster
 * client will automatically sign the user out of this mini app as well.
 *
 * @returns {UseQuickAuthReturn} Object containing user state and authentication methods
 *
 * @example
 * ```tsx
 * const { authenticatedUser, status, signIn, signOut } = useQuickAuth();
 *
 * if (status === 'loading') return <div>Loading...</div>;
 * if (status === 'unauthenticated') return <button onClick={signIn}>Sign In</button>;
 *
 * return (
 *   <div>
 *     <p>Welcome, FID: {authenticatedUser?.fid}</p>
 *     <button onClick={signOut}>Sign Out</button>
 *   </div>
 * );
 * ```
 */
export function useQuickAuth(): UseQuickAuthReturn {
  // Current authenticated user data
  const [authenticatedUser, setAuthenticatedUser] =
    useState<AuthenticatedUser | null>(null);
  // Current authentication status
  const [status, setStatus] = useState<QuickAuthStatus>('loading');

  /**
   * Validates a QuickAuth token with the server-side API
   *
   * @param {string} authToken - The JWT token to validate
   * @returns {Promise<AuthenticatedUser | null>} User data if valid, null otherwise
   */
  const validateTokenWithServer = async (
    authToken: string,
  ): Promise<AuthenticatedUser | null> => {
    try {
      console.log('Validating token with server...');
      const validationResponse = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authToken }),
      });

      console.log('Validation response status:', validationResponse.status);

      if (validationResponse.ok) {
        const responseData = await validationResponse.json();
        console.log('Validation successful:', responseData);
        return responseData.user;
      }

      const errorData = await validationResponse.json();
      console.error('Validation failed:', errorData);
      return null;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  };

  /**
   * Checks for existing authentication token and validates it on component mount
   * This runs automatically when the hook is first used
   */
  useEffect(() => {
    const checkExistingAuthentication = async () => {
      try {
        // Attempt to retrieve existing token from QuickAuth SDK
        const { token } = await sdk.quickAuth.getToken();

        if (token) {
          // Validate the token with our server-side API
          const validatedUserSession = await validateTokenWithServer(token);

          if (validatedUserSession) {
            // Token is valid, set authenticated state
            setAuthenticatedUser(validatedUserSession);
            setStatus('authenticated');
          } else {
            // Token is invalid or expired, clear authentication state
            setStatus('unauthenticated');
          }
        } else {
          // No existing token found, user is not authenticated
          setStatus('unauthenticated');
        }
      } catch (error) {
        console.error('Error checking existing authentication:', error);
        setStatus('unauthenticated');
      }
    };

    checkExistingAuthentication();
  }, []);

  /**
   * Initiates the QuickAuth sign-in process
   *
   * Uses sdk.quickAuth.getToken() to get a QuickAuth session token.
   * If there is already a session token in memory that hasn't expired,
   * it will be immediately returned, otherwise a fresh one will be acquired.
   *
   * @returns {Promise<boolean>} True if sign-in was successful, false otherwise
   */
  const signIn = useCallback(async (): Promise<boolean> => {
    try {
      setStatus('loading');

      console.log('Getting QuickAuth token...');
      console.log('SDK context available:', sdk.context);
      
      // Get QuickAuth session token
      let result;
      try {
        result = await sdk.quickAuth.getToken();
        console.log('✓ QuickAuth getToken() completed');
        console.log('QuickAuth result:', result);
        console.log('Result type:', typeof result);
        console.log('Result keys:', result ? Object.keys(result) : 'null');
        console.log('Result.token:', result?.token);
        console.log('Result as JSON:', JSON.stringify(result));
      } catch (getTokenError) {
        console.error('✗ QuickAuth getToken() failed:', getTokenError);
        console.error('Error type:', typeof getTokenError);
        console.error('Error message:', getTokenError instanceof Error ? getTokenError.message : 'Unknown');
        throw getTokenError;
      }

      const { token } = result || {};
      console.log('Token received:', token ? 'Yes' : 'No');
      
      if (token) {
        console.log('Token length:', token.length);
        // Validate the token with our server-side API
        const validatedUserSession = await validateTokenWithServer(token);

        if (validatedUserSession) {
          // Authentication successful, update user state
          console.log('Authentication successful!');
          setAuthenticatedUser(validatedUserSession);
          setStatus('authenticated');
          return true;
        } else {
          console.log('Token validation failed');
        }
      } else {
        console.log('No token returned from QuickAuth');
      }

      // Authentication failed, clear user state
      setStatus('unauthenticated');
      return false;
    } catch (error) {
      console.error('Sign-in process failed with error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      setStatus('unauthenticated');
      return false;
    }
  }, []);

  /**
   * Signs out the current user and clears the authentication state
   *
   * Since QuickAuth tokens are managed in memory only, this simply clears
   * the local user state. The actual token will be cleared when the
   * user signs out of their Farcaster client.
   */
  const signOut = useCallback(async (): Promise<void> => {
    // Clear local user state
    setAuthenticatedUser(null);
    setStatus('unauthenticated');
  }, []);

  /**
   * Retrieves the current authentication token from QuickAuth
   *
   * @returns {Promise<string | null>} The current auth token, or null if not authenticated
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const { token } = await sdk.quickAuth.getToken();
      return token;
    } catch (error) {
      console.error('Failed to retrieve authentication token:', error);
      return null;
    }
  }, []);

  return {
    authenticatedUser,
    status,
    signIn,
    signOut,
    getToken,
  };
}