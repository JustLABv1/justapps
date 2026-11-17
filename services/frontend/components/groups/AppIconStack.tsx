import { GroupIcon } from "@/components/GroupIcon";
import type { AppConfig } from "@/config/apps";

/** A row of overlapping app logos with a count of the rest, so a group shows what is in it at a glance. */
export function AppIconStack({ apps, max = 5, size = "md" }: { apps: AppConfig[]; max?: number; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-7 rounded-lg text-[10px]" : "size-9 rounded-xl text-xs";
  const shown = apps.slice(0, max);
  const rest = apps.length - shown.length;
  if (apps.length === 0) return null;
  return (
    <div className="flex items-center" aria-label={`${apps.length} ${apps.length === 1 ? "App" : "Apps"}: ${shown.map((app) => app.name).join(", ")}${rest ? ` und ${rest} weitere` : ""}`}>
      {shown.map((app, index) => (
        <GroupIcon
          key={app.id}
          icon={app.icon}
          name=""
          fallback={<span className="text-[11px] font-semibold">{app.name.charAt(0)}</span>}
          className={`${box} border bg-background text-foreground ring-2 ring-card ${index > 0 ? "-ms-2" : ""}`}
        />
      ))}
      {rest > 0 && (
        <span className={`-ms-2 inline-flex items-center justify-center border bg-muted font-medium text-muted-foreground ring-2 ring-card tabular-nums ${box}`}>
          +{rest}
        </span>
      )}
    </div>
  );
}
