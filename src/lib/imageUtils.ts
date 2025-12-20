/**
 * Image utility functions for handling CDN-hosted images
 */

const IMAGE_CDN_BASE = 'https://vectorcoil.com/cx';

/**
 * Converts a local image path to a CDN URL
 * @param path - Image path (e.g., '/images/gigs/gig-001.png' or 'images/gigs/gig-001.png')
 * @returns Full CDN URL
 */
export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // If already a full URL, return as-is
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }
  
  return `${IMAGE_CDN_BASE}/${cleanPath}`;
}

/**
 * Helper for common image paths
 */
export const images = {
  gig: (filename: string) => getImageUrl(`images/gigs/${filename}`),
  precept: (filename: string) => getImageUrl(`images/precepts/${filename}`),
  city: (filename: string) => getImageUrl(`images/${filename}`),
  icon: (filename: string) => getImageUrl(`${filename}`), // For root-level icons
  default: (path: string) => getImageUrl(path),
};
