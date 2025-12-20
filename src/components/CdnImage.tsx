/**
 * Image component that automatically handles CDN URLs
 * Use this instead of <img> for database-sourced images
 */

import React from 'react';
import { getImageUrl } from '../lib/imageUtils';

interface CdnImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
}

export function CdnImage({ src, alt = '', ...props }: CdnImageProps) {
  const cdnUrl = getImageUrl(src);
  
  if (!cdnUrl) {
    return null;
  }
  
  return <img src={cdnUrl} alt={alt} {...props} />;
}
