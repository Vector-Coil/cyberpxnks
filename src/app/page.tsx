/*
import { Metadata } from "next";
import App from "./app";
import { APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: APP_NAME,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [APP_OG_IMAGE_URL],
    },
    other: {
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata()),
    },
  };
}

export default function Home() {
  return (<App />);
}
*/


"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';

// --- SERVER ACTION IMPORTS ---
// This calls the lib/actions.ts file to securely check the MySQL database
import { checkMySQLRegistration } from '~/lib/actions'; 

// --- FIREBASE IMPORTS (Kept for Environment Authentication and Future Use) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, Auth } from 'firebase/auth'; // Import Auth type
import { 
  getFirestore, 
  setLogLevel,
  Firestore // Import Firestore type
} from 'firebase/firestore';

// --- TYPESCRIPT GLOBAL DECLARATIONS (Fixes Codes 2304, 2552) ---
// These are required for TypeScript to recognize the global variables injected by the Canvas environment.
declare global {
  var __app_id: string | undefined;
  var __firebase_config: string | undefined;
  var __initial_auth_token: string | undefined;
}

// --- FIREBASE GLOBAL VARIABLES (Mandatory for Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config || '{}') : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- MOCK DATA ---
// NOTE: This MUST be replaced with the actual FID retrieved after successful Farcaster Sign-In
const mockFarcasterFid: number = 123456; 

// --- TYPE DEFINITIONS ---
interface AppRouter {
    // FIX: Removed 'pathname: string;' to resolve conflict with Next.js App Router
    push: (path: string) => void;
}

// Main component that handles the routing logic
const App: React.FC = () => {
    // We use the real useRouter import, but assert its type for the mock environment
    // The cast is still necessary to satisfy the requirements of the local mock
    const router = useRouter() as AppRouter; 
    
    // State variables
    const [db, setDb] = useState<Firestore | null>(null);
    const [auth, setAuth] = useState<Auth | null>(null);
    const [status, setStatus] = useState<string>('Initializing...'); 
    const [farcasterFid] = useState<number>(mockFarcasterFid); // Placeholder FID
    const [authReady, setAuthReady] = useState<boolean>(false);

    // 0. Signal to Farcaster that the app is ready
    useEffect(() => {
        // Call ready() when component mounts to signal the mini-app is loaded
        sdk.actions.ready();
    }, []);

    // 1. Initialize Firebase and Authenticate
    useEffect(() => {
        if (firebaseConfig && !db) {
            try {
                setLogLevel('debug'); 
                const app = initializeApp(firebaseConfig);
                const firestore = getFirestore(app);
                const firebaseAuth = getAuth(app);
                
                setDb(firestore);
                setAuth(firebaseAuth);
                setStatus('Authenticating...');

                const authenticate = async () => {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                        setStatus('Authentication successful. Starting registration check...');
                        setAuthReady(true);
                    } catch (error) {
                        console.error("Authentication Error:", error);
                        setStatus('Authentication Failed.');
                    }
                };
                authenticate();
            } catch (error) {
                console.error("Initialization Error:", error);
                setStatus('Initialization Failed.');
            }
        }
    }, [db, initialAuthToken, firebaseConfig]);

    // 2. Check Registration Status in MySQL and Redirect
    const checkRegistrationAndRoute = useCallback(async () => {
        // Ensure authentication is complete and we have a FID
        if (!authReady || !farcasterFid) return;
        
        setStatus('Checking MySQL registration...');

        try {
            // CALL THE SERVER ACTION (MySQL Check)
            const isRegistered = await checkMySQLRegistration(farcasterFid);

            if (isRegistered) {
                // User is registered -> Redirect to Dashboard
                setStatus(`User FID ${farcasterFid} FOUND in MySQL. Redirecting to Dashboard...`);
                router.push('/dashboard');
            } else {
                // User is NOT registered -> Redirect to Onboarding
                setStatus(`User FID ${farcasterFid} NOT found in MySQL. Redirecting to Onboarding...`);
                router.push('/onboarding');
            }
        } catch (error) {
            console.error("Registration Check Error:", error);
            setStatus('Error during MySQL check. Redirecting to Onboarding as fallback.');
            router.push('/onboarding');
        }
    }, [authReady, farcasterFid, router]);

    useEffect(() => {
        if (authReady) {
            checkRegistrationAndRoute();
        }
    }, [authReady, checkRegistrationAndRoute]);

    // --- Mock UI: Show Status While Routing is Active ---
    
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="p-6 bg-white rounded-xl shadow-2xl w-full max-w-sm text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-t-purple-500 border-gray-200 rounded-full"></div>
                <h1 className="mt-4 text-xl font-extrabold text-gray-800">Cyberpxnks Router</h1>
                <p className="mt-2 text-md font-medium text-purple-600">
                    {status}
                </p>
                <div className="mt-4 text-sm text-gray-500">
                    <p>Testing Farcaster ID: <code className="font-mono text-purple-700 font-bold">{farcasterFid}</code></p>
                    <p>(Redirecting based on MySQL 'users' table)</p>
                </div>
            </div>
        </div>
    );
};

// --- FIX: Renamed local mock to avoid conflict with the Next.js import. ---
// This mock is only needed for the Canvas environment simulation.
const useRouterMock = (): AppRouter => {
    // Removed local pathname state as it's not strictly necessary for Canvas demo function
    // and conflicts with the type definition used by Next.js in the user's project.
    return {
        push: (path: string) => {
            console.log(`[ROUTE MOCK] Redirecting to ${path}`);
            // Note: In a real project, this function would not be executed.
        }
    };
};

export default App;
