"use client";
import { useState, useEffect } from 'react';
import { formatTimeRemaining } from '../lib/timeUtils';

/**
 * Hook to manage countdown timer for time-based actions
 * Automatically updates every second and returns formatted time string
 * @param endTime - End time as Date, string, or timestamp
 * @returns Formatted time remaining string and isComplete flag
 */
export function useCountdownTimer(endTime: Date | string | number | null): {
  timeRemaining: string;
  isComplete: boolean;
} {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!endTime) {
      setTimeRemaining('');
      setIsComplete(false);
      return;
    }

    // Initial calculation
    const updateTimer = () => {
      const formatted = formatTimeRemaining(endTime);
      const complete = formatted === '00:00:00 to completion';
      
      setTimeRemaining(formatted);
      setIsComplete(complete);
      
      return complete;
    };

    // Update immediately
    const complete = updateTimer();
    
    // Don't set up interval if already complete
    if (complete) return;

    // Update every second
    const interval = setInterval(() => {
      const nowComplete = updateTimer();
      if (nowComplete) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return { timeRemaining, isComplete };
}
