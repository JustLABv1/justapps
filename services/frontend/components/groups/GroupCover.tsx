import { GroupIcon } from "@/components/GroupIcon";
import type { AppConfig } from "@/config/apps";
import type { CSSProperties } from "react";

// Where the scattered app logos sit on the cover, from the right edge inwards.
const SLOTS = [
  { right: "1.25rem", top: "1rem", rotate: 7 },
  { right: "4.75rem", top: "2.6rem", rotate: -8 },
  { right: "8.25rem", top: "0.9rem", rotate: 4 },
  { right: "11.75rem", top: "2.8rem", rotate: -5 },
  { right: "15.25rem", top: "1.4rem", rotate: 9 },
];

/**
 * The tinted band at the top of a group: the group's own colour, with a few of
 * its apps' logos scattered over it. They straighten up when the card is hovered.
 */
export function GroupCover({ color, apps, className = "h-28" }: { color: string; apps: AppConfig[]; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklab,var(--group)_32%,var(--card)),color-mix(in_oklab,var(--group)_10%,var(--card))_70%)] ${className}`}
      style={{ "--group": color } as CSSProperties}
    >
      {/* A soft glow and a dotted texture, so the band has some depth. */}
      <div className="absolute -top-10 -left-10 size-40 rounded-full bg-[color-mix(in_oklab,var(--group)_35%,transparent)] blur-2xl" />
      <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,var(--group)_30%,transparent)_1px,transparent_1px)] [background-size:14px_14px] opacity-60 [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
      {apps.slice(0, SLOTS.length).map((app, index) => (
        <span
          key={app.id}
          className="absolute transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:rotate-0! motion-reduce:transition-none"
          style={{ right: SLOTS[index].right, top: SLOTS[index].top, rotate: `${SLOTS[index].rotate}deg` }}
        >
          <GroupIcon
            icon={app.icon}
            name=""
            fallback={<span className="text-sm font-semibold">{app.name.charAt(0)}</span>}
            className="size-12 rounded-xl border bg-background text-foreground shadow-md"
          />
        </span>
      ))}
    </div>
  );
}
