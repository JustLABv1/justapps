import type { ReactNode } from 'react';

import { Layers2 } from 'lucide-react';
import Image from 'next/image';

interface GroupIconProps {
  icon?: string;
  name: string;
  className?: string;
  fallback?: ReactNode;
}

function isImageSource(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^(https?:|data:|blob:|\/)/.test(value) || /\.(png|jpe?g|svg|webp|ico)(\?.*)?$/i.test(value);
}

export function GroupIcon({
  icon,
  name,
  className = 'h-10 w-10 rounded-xl bg-accent/10 text-accent',
  fallback,
}: GroupIconProps) {
  return (
    <span className={`relative inline-flex items-center justify-center overflow-hidden ${className}`}>
      {isImageSource(icon) ? (
        <Image src={icon || ''} alt={name} fill className="object-contain p-2" sizes="48px" unoptimized />
      ) : icon ? (
        <span className="text-base leading-none">{icon}</span>
      ) : (
        fallback || <Layers2 className="h-4 w-4" />
      )}
    </span>
  );
}