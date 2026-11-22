import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import { isSafeHttpUrl } from '../lib/format';

interface TrackArtworkProps {
  src?: string;
  alt: string;
  className?: string;
  iconSize?: number;
}

export const TrackArtwork: React.FC<TrackArtworkProps> = ({
  src,
  alt,
  className = 'w-12 h-12 rounded-lg',
  iconSize = 20,
}) => {
  const [failed, setFailed] = useState(false);
  const validSrc = !failed && isSafeHttpUrl(src) ? src : '';

  if (!validSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#1A1F27] to-[#111419] border border-white/10 text-[#9CA3AF] shrink-0 ${className}`}
        aria-label={alt}
      >
        <Music2 size={iconSize} strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <img
      src={validSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover bg-[#13161B] shrink-0 ${className}`}
    />
  );
};
