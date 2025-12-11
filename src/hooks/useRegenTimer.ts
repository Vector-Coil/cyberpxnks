import { useState, useEffect } from 'react';

interface RegenTimerResult {
  timeToRegen: string;
  minutesUntil: number;
  secondsUntil: number;
}

/**
 * Hook to calculate and display time until next regeneration interval
 * Regen happens every 15 minutes (:00, :15, :30, :45)
 */
export function useRegenTimer(): RegenTimerResult {
  const [timeToRegen, setTimeToRegen] = useState('');
  const [minutesUntil, setMinutesUntil] = useState(0);
  const [secondsUntil, setSecondsUntil] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      // Regen happens at :00, :15, :30, :45
      const currentInterval = Math.floor(minutes / 15);
      const nextRegenMinute = (currentInterval + 1) * 15;
      
      // Calculate time until next interval
      let mins = nextRegenMinute - minutes - 1;
      let secs = 60 - seconds;

      if (secs === 60) {
        mins += 1;
        secs = 0;
      }

      // Handle transition to next hour
      if (nextRegenMinute >= 60) {
        mins = 60 - minutes - 1;
        secs = 60 - seconds;
        if (secs === 60) {
          mins += 1;
          secs = 0;
        }
      }

      setMinutesUntil(mins);
      setSecondsUntil(secs);
      setTimeToRegen(`${mins}m ${secs}s`);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  return { timeToRegen, minutesUntil, secondsUntil };
}
