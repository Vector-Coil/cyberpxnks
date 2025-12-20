/**
 * Time formatting and countdown utilities
 */

/**
 * Convert a timestamp to a relative time string like "5 minutes ago", "2 days ago", etc.
 */
export function getRelativeTime(timestamp: string | Date): string {
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 30) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}

/**
 * Format milliseconds into HH:MM:SS countdown string
 * @param endTime - End timestamp or Date object
 * @returns Formatted time string like "01:23:45 to completion"
 */
export function formatTimeRemaining(endTime: Date | string | number): string {
  const now = new Date().getTime();
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : 
              endTime instanceof Date ? endTime.getTime() : endTime;
  
  const distance = end - now;
  
  if (distance <= 0) {
    return '00:00:00 to completion';
  }
  
  const hours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} to completion`;
}

/**
 * Get time components from end time
 * @param endTime - End timestamp or Date object
 * @returns Object with hours, minutes, seconds, and isComplete flag
 */
export function getTimeComponents(endTime: Date | string | number): {
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
  distance: number;
} {
  const now = new Date().getTime();
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : 
              endTime instanceof Date ? endTime.getTime() : endTime;
  
  const distance = end - now;
  
  if (distance <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, isComplete: true, distance: 0 };
  }
  
  const hours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds, isComplete: false, distance };
}

/**
 * Format relative time for activity logs (e.g., "2h ago", "5m ago")
 */
export function formatRelativeTime(timestamp: string | Date): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp.getTime();
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
