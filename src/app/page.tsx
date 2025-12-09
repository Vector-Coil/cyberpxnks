"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sdk } from '@farcaster/miniapp-sdk';
import { checkMySQLRegistration } from '~/lib/actions';
import { NeynarAuthButton, useNeynarContext } from '@neynar/react';
import Image from 'next/image';

/**
 * Landing Page Component
 * 
 * Displays the Cyberpxnks title screen with Farcaster authentication.
 * After successful authentication, checks if user is registered and routes accordingly:
 * - Registered users → Dashboard
 * - New users → Onboarding flow
 */
export default function Home() {
  const router = useRouter();
  const { user: neynarUser } = useNeynarContext();
  
  const [isChecking, setIsChecking] = useState(false);
  const [showAuthButton, setShowAuthButton] = useState(false);

  // Check for user authentication and route accordingly
  useEffect(() => {
    const checkUserAndRoute = async () => {
      try {
        sdk.actions.ready();
        
        // Wait for SDK to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // First, try to get user from SDK context (works in Farcaster mini-app)
        try {
          const context = await sdk.context;
          const fid = context?.user?.fid;
          
          if (fid) {
            console.log('✓ User FID from SDK context:', fid);
            setIsChecking(true);
            
            const result = await checkMySQLRegistration(fid);
            
            if (result.success) {
              console.log('User is registered, routing to dashboard');
              router.push('/dashboard');
            } else {
              console.log('User not registered, routing to onboarding');
              router.push('/onboarding');
            }
            return;
          }
        } catch (sdkError) {
          console.log('No SDK context available');
        }
        
        // Second, check for Neynar authentication (works in web browser)
        if (neynarUser?.fid) {
          console.log('✓ User FID from Neynar:', neynarUser.fid);
          setIsChecking(true);
          
          const result = await checkMySQLRegistration(neynarUser.fid);
          
          if (result.success) {
            console.log('User is registered, routing to dashboard');
            router.push('/dashboard');
          } else {
            console.log('User not registered, routing to onboarding');
            router.push('/onboarding');
          }
          return;
        }
        
        // If no authentication, show the landing page with auth button
        console.log('No authentication found, showing landing page');
        setShowAuthButton(true);
      } catch (error) {
        console.error('Error during initialization:', error);
        setShowAuthButton(true);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkUserAndRoute();
  }, [router, neynarUser]);

  // Immediately check and route when neynarUser changes
  useEffect(() => {
    if (neynarUser?.fid && !isChecking) {
      const routeAuthenticatedUser = async () => {
        console.log('✓ Neynar user authenticated, routing...');
        setIsChecking(true);
        
        try {
          const result = await checkMySQLRegistration(neynarUser.fid);
          
          if (result.success) {
            console.log('User is registered, routing to dashboard');
            router.push('/dashboard');
          } else {
            console.log('User not registered, routing to onboarding');
            router.push('/onboarding');
          }
        } catch (error) {
          console.error('Error checking registration:', error);
          router.push('/onboarding');
        }
      };
      
      routeAuthenticatedUser();
    }
  }, [neynarUser, isChecking, router]);

  // Show loading state while checking registration
  if (isChecking) {
    return (
      <div className="frame-container frame-landing">
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-t-cyan-400 border-purple-600 rounded-full mb-4"></div>
          <p className="text-cyan-400 text-lg font-mono">CHECKING ACCESS...</p>
        </div>
      </div>
    );
  }

  // Main title screen
  return (
    <div className="frame-container frame-landing">
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 space-y-8">
        {/* Animated Title Image with Gradient Overlay */}
        <div className="relative w-full max-w-[360px] mb-4">
          {/* Base title image */}
          <Image
            src="/cx-title.png"
            alt="CYBERPXNKS"
            width={360}
            height={120}
            priority
            className="w-full h-auto"
          />
          {/* Gradient overlay clipped to image shape */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="w-full h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-pulse"
              style={{ 
                animationDuration: '3s',
                maskImage: 'url(/cx-title.png)',
                WebkitMaskImage: 'url(/cx-title.png)',
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                opacity: 0.4
              }}
            ></div>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xl text-cyan-300 font-mono tracking-wider">
          ENTER THE GRID
        </p>

        {/* Glitch effect decoration */}
        <div className="relative w-full max-w-[300px] h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse"></div>
        </div>

        {/* Tagline */}
        <p className="text-gray-400 text-base max-w-[340px] text-center px-4">
          A cyberpunk RPG experience. Connect your Farcaster account to begin your journey.
        </p>

        {/* Auth Button */}
        {showAuthButton && (
          <div className="pt-4 w-full max-w-[340px] neynar-auth-button-custom">
            <NeynarAuthButton 
              label="CONNECT WITH FARCASTER"
            />
          </div>
        )}
      </div>
    </div>
  );
}
