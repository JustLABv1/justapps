import { SVGProps } from 'react';

/** JustApps monogram: an app tile above a rounded lowercase j. */
export function JustAppsLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      fill="#4655F5"
      aria-hidden="true"
      {...props}
    >
      <rect x="272" y="72" width="112" height="112" rx="32" />
      <path d="M304 208h48a32 32 0 0 1 32 32v72c0 79.529-64.471 144-144 144h-64a56 56 0 0 1 0-112h64a32 32 0 0 0 32-32v-72a32 32 0 0 1 32-32Z" />
    </svg>
  );
}
