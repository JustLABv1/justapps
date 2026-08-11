"use client";

import Image from "next/image";
import type { ComponentProps } from "react";

export function DocsBrand({ className, ...props }: ComponentProps<"a">) {
  return (
    <a
      {...props}
      className={`flex min-w-0 items-center gap-2 font-semibold text-fd-foreground ${className ?? ""}`.trim()}
      aria-label="JustApps documentation home"
    >
      <Image
        // next/image resolves its source independently of Next.js basePath.
        // Keep the public source under /docs so the optimizer can fetch it.
        src="/docs/justapps-logo.svg"
        alt=""
        width={28}
        height={28}
        priority
        className="size-7 shrink-0"
      />
      <span className="truncate">JustApps Documentation</span>
    </a>
  );
}
