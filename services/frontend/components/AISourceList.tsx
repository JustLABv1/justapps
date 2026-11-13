'use client';

import type { AIMessageSource } from '@/lib/ai';
import { Badge } from '@/components/panelui/badge';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

function sourceHref(source: AIMessageSource): string | null {
  if (!source.appId) return null;
  const sourceType = source.sourceType.toLowerCase();
  const anchor = sourceType.includes('release') || sourceType.includes('changelog')
    ? '#changelog'
    : sourceType.includes('deployment')
      ? '#deployment'
      : sourceType.includes('custom')
        ? '#details'
        : '#docs';
  return `/apps/${encodeURIComponent(source.appId)}${anchor}`;
}

export function AISourceList({ sources, compact = false }: { sources: AIMessageSource[]; compact?: boolean }) {
  const visibleSources = sources.filter((source) => source.appId || source.title || source.appName);
  if (visibleSources.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quellen</p>
      <div className="flex flex-wrap gap-1.5">
        {visibleSources.slice(0, compact ? 3 : 8).map((source, index) => {
          const label = source.title || source.appName || 'App-Kontext';
          const text = source.appName && source.title && source.appName !== source.title ? `${source.appName}: ${source.title}` : label;
          const href = sourceHref(source);
          const key = `${source.chunkId}-${source.sourceId}-${index}`;

          return (
            <Badge
              key={key}
              variant="outline"
              title={source.snippet || label}
              className="max-w-full"
              render={href ? <Link href={href} className="hover:bg-accent" /> : undefined}
            >
              <span className="max-w-[15rem] truncate">{text}</span>
              {href && <ExternalLink />}
            </Badge>
          );
        })}
        {visibleSources.length > (compact ? 3 : 8) && (
          <Badge variant="secondary">+{visibleSources.length - (compact ? 3 : 8)} weitere</Badge>
        )}
      </div>
      {!compact && visibleSources[0]?.snippet && (
        <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{visibleSources[0].snippet}</p>
      )}
    </div>
  );
}
