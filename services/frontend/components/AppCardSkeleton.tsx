export function AppCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden animate-pulse">
      {/* Header: icon + title block */}
      <div className="p-6 pb-2 flex flex-row items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border shrink-0" />
        <div className="flex flex-col gap-2.5 flex-1 pt-1">
          <div className="h-5 bg-surface-secondary rounded-lg w-3/4" />
          <div className="h-3 bg-surface-secondary rounded-md w-1/2" />
        </div>
      </div>

      {/* Body: description lines + status */}
      <div className="px-6 pt-3 pb-5 flex flex-col gap-2">
        <div className="h-3 bg-surface-secondary rounded w-full" />
        <div className="h-3 bg-surface-secondary rounded w-5/6" />
        <div className="h-3 bg-surface-secondary rounded w-2/3" />
        <div className="mt-3 flex items-center gap-2">
          <div className="h-3 w-10 bg-surface-secondary rounded" />
          <div className="h-5 w-20 bg-surface-secondary rounded-full" />
        </div>
      </div>

      {/* Footer: favorite + quick-link button */}
      <div className="border-t border-border/50 bg-surface-secondary/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-surface-secondary rounded-full" />
          <div className="h-3 w-16 bg-surface-secondary rounded" />
        </div>
        <div className="h-7 w-28 bg-surface-secondary rounded-full" />
      </div>
    </div>
  );
}
