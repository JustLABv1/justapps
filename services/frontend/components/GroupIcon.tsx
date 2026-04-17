import type { ReactNode } from 'react';

import { getImageAssetUrl } from '@/lib/assets';
import { Layers2 } from 'lucide-react';
import Image from 'next/image';

interface GroupIconProps {
  icon?: string;
  name: string;
  className?: string;
  fallback?: ReactNode;
}

export function GroupIcon({
  icon,
  name,
  className = 'h-10 w-10 rounded-xl bg-accent/10 text-accent',
  fallback,
}: GroupIconProps) {
  const iconSrc = getImageAssetUrl(icon);

  return (
    <span className={`relative inline-flex items-center justify-center overflow-hidden ${className}`}>
      {iconSrc ? (
        <Image src={iconSrc} alt={name} fill className="object-contain p-2" sizes="48px" unoptimized />
      ) : icon ? (
        <span className="text-base leading-none">{icon}</span>
      ) : (
        fallback || <Layers2 className="h-4 w-4" />
      )}
    </span>
  );
}