import React, { SVGProps } from 'react';

export function JustAppsLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="cyan-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="purple-pink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="yellow-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
        <linearGradient id="green-teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>

        <filter id="app-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="16"
            stdDeviation="20"
            floodColor="#000000"
            floodOpacity="0.15"
          />
        </filter>
      </defs>

      {/* Base App Store Background (Squircle) - Uses Tailwind to respond to app theme manually */}
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="112"
        className="fill-white dark:fill-[#0B1120]"
      />

      {/* The App Grid Layer */}
      <g filter="url(#app-shadow)">
        <rect x="116" y="116" width="124" height="124" rx="40" fill="url(#cyan-blue)" />
        <rect x="272" y="116" width="124" height="124" rx="40" fill="url(#purple-pink)" />
        <rect x="116" y="272" width="124" height="124" rx="40" fill="url(#green-teal)" />
        <circle cx="334" cy="334" r="62" fill="url(#yellow-red)" />
      </g>
    </svg>
  );
}
