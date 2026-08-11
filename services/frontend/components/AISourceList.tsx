'use client';

import type { AIMessageSource } from '@/lib/ai';
import { Chip } from '@heroui/react';
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Quellen</p>
      <div className="flex flex-wrap gap-1.5">
        {visibleSources.slice(0, compact ? 3 : 8).map((source, index) => {
          const label = source.title || source.appName || 'App-Kontext';
          const content = (
            <Chip size="sm" variant="soft" className="max-w-full gap-1 text-[10px] font-medium">
              <span className="max-w-[15rem] truncate">{source.appName && source.title && source.appName !== source.title ? `${source.appName}: ${source.title}` : label}</span>
              {sourceHref(source) && <ExternalLink className="h-3 w-3 shrink-0" />}
            </Chip>
          );

          if (!sourceHref(source)) {
            return <span key={`${source.chunkId}-${source.sourceId}-${index}`} title={source.snippet || label}>{content}</span>;
          }

          return (
            <Link
              key={`${source.chunkId}-${source.sourceId}-${index}`}
              href={sourceHref(source) as string}
              title={source.snippet || label}
              className="max-w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {content}
            </Link>
          );
        })}
        {visibleSources.length > (compact ? 3 : 8) && (
          <Chip size="sm" variant="soft" className="text-[10px] text-muted">+{visibleSources.length - (compact ? 3 : 8)} weitere</Chip>
        )}
      </div>
      {!compact && visibleSources[0]?.snippet && (
        <p className="max-w-2xl text-xs leading-5 text-muted">{visibleSources[0].snippet}</p>
      )}
    </div>
  );
}
