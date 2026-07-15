"use client";

import { Chip, Surface } from "@heroui/react";
import type { ReactNode } from "react";

interface EditorActionBarProps {
  actions: ReactNode;
  children?: ReactNode;
  progressLabel?: string;
  statusColor?: "default" | "success" | "accent" | "warning";
  statusLabel: string;
}

export function EditorActionBar({
  actions,
  children,
  progressLabel,
  statusColor = "default",
  statusLabel,
}: EditorActionBarProps) {
  return (
    <div
      data-editor-action-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 shadow-lg backdrop-blur-sm"
    >
      <Surface
        variant="default"
        className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {progressLabel && (
              <span className="text-xs font-semibold text-muted">
                {progressLabel}
              </span>
            )}
            <Chip color={statusColor} size="sm" variant="soft">
              {statusLabel}
            </Chip>
          </div>
          {children && <div className="mt-1.5 min-h-4">{children}</div>}
        </div>
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </Surface>
    </div>
  );
}
