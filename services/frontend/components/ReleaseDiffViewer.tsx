'use client';

import type { ReleaseChangeDetail } from '@/config/apps';
import { Button, Card, Chip, ScrollShadow } from '@heroui/react';
import { Columns2, Rows3 } from 'lucide-react';
import { useMemo, useState } from 'react';

type DiffLine = {
  kind: 'context' | 'add' | 'remove' | 'meta';
  text: string;
};

function parseUnifiedDiff(diff: string): DiffLine[] {
  return diff.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      return { kind: 'meta', text: line };
    }
    if (line.startsWith('+')) {
      return { kind: 'add', text: line };
    }
    if (line.startsWith('-')) {
      return { kind: 'remove', text: line };
    }
    return { kind: 'context', text: line };
  });
}

function tokenizeLine(line: string, language: string) {
  if (language === 'yaml') {
    const match = line.match(/^(\s*[^:#]+:\s*)(.*)$/);
    if (match) {
      return (
        <>
          <span className="text-sky-300">{match[1]}</span>
          <span className="text-amber-200">{match[2]}</span>
        </>
      );
    }
    if (line.trimStart().startsWith('- ')) {
      const prefix = line.slice(0, line.indexOf('- ') + 2);
      const rest = line.slice(line.indexOf('- ') + 2);
      return (
        <>
          <span className="text-violet-300">{prefix}</span>
          <span className="text-amber-200">{rest}</span>
        </>
      );
    }
  }

  if (language === 'markdown') {
    if (line.startsWith('#')) {
      return <span className="text-sky-300 font-semibold">{line}</span>;
    }
    if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
      return <span className="text-violet-300">{line}</span>;
    }
    if (line.startsWith('```')) {
      return <span className="text-emerald-300">{line}</span>;
    }
  }

  return <span>{line}</span>;
}

function renderDiffLine(line: DiffLine, language: string) {
  const marker = line.kind === 'context' ? ' ' : line.text.slice(0, 1);
  const content = line.kind === 'context' ? line.text : line.text.slice(1);

  return (
    <>
      <span className="select-none text-muted">{marker}</span>
      {tokenizeLine(content, language)}
    </>
  );
}

function collapseLines(lines: DiffLine[]) {
  const result: Array<DiffLine | { kind: 'collapsed'; hiddenCount: number }> = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].kind !== 'context') {
      result.push(lines[index]);
      index++;
      continue;
    }

    let end = index;
    for (; end < lines.length && lines[end].kind === 'context'; end++) {
      // noop
    }

    const runLength = end - index;
    if (runLength > 6) {
      result.push(...lines.slice(index, index + 2));
      result.push({ kind: 'collapsed', hiddenCount: runLength - 4 });
      result.push(...lines.slice(end - 2, end));
    } else {
      result.push(...lines.slice(index, end));
    }
    index = end;
  }
  return result;
}

function getDiffClasses(kind: DiffLine['kind']) {
  switch (kind) {
    case 'add':
      return 'bg-success/10 text-success';
    case 'remove':
      return 'bg-danger/10 text-danger';
    case 'meta':
      return 'bg-accent/10 text-accent';
    default:
      return 'text-foreground';
  }
}

function splitPlainLines(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split('\n') : [];
}

function shouldShowSideBySide(detail: ReleaseChangeDetail) {
  const lineCount = Math.max(splitPlainLines(detail.beforeText).length, splitPlainLines(detail.afterText).length);
  return detail.area === 'deployment' && lineCount >= 12;
}

function SideBySideView({ detail }: { detail: ReleaseChangeDetail }) {
  const beforeLines = splitPlainLines(detail.beforeText);
  const afterLines = splitPlainLines(detail.afterText);
  const rowCount = Math.max(beforeLines.length, afterLines.length);
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    before: beforeLines[index] ?? '',
    after: afterLines[index] ?? '',
  }));

  return (
    <ScrollShadow orientation="horizontal" className="max-w-full">
      <div className="min-w-[760px] overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-2 bg-surface-secondary text-xs font-semibold uppercase tracking-wide text-muted">
          <div className="border-r border-border px-3 py-2">Vorher</div>
          <div className="px-3 py-2">Nachher</div>
        </div>
        <div className="grid grid-cols-2">
          <div className="border-r border-border bg-danger/5">
            {rows.map((row, index) => (
              <div key={`before-${index}`} className="border-t border-border/60 px-3 py-1.5 font-mono text-xs whitespace-pre-wrap">
                {tokenizeLine(row.before, detail.language)}
              </div>
            ))}
          </div>
          <div className="bg-success/5">
            {rows.map((row, index) => (
              <div key={`after-${index}`} className="border-t border-border/60 px-3 py-1.5 font-mono text-xs whitespace-pre-wrap">
                {tokenizeLine(row.after, detail.language)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollShadow>
  );
}

export function ReleaseDiffViewer({ detail }: { detail: ReleaseChangeDetail }) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(shouldShowSideBySide(detail) ? 'split' : 'unified');
  const parsedLines = useMemo(() => collapseLines(parseUnifiedDiff(detail.diff)), [detail.diff]);
  const sideBySideAllowed = shouldShowSideBySide(detail);

  return (
    <Card variant="default" className="overflow-hidden border border-border bg-surface">
      <Card.Header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft" className="text-[10px] font-bold uppercase">
              {detail.area}
            </Chip>
            <Card.Title className="text-sm">{detail.label}</Card.Title>
          </div>
          {detail.preview && (
            <Card.Description>{detail.preview}</Card.Description>
          )}
        </div>
        {sideBySideAllowed && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === 'unified' ? 'secondary' : 'ghost'}
              isIconOnly
              onPress={() => setViewMode('unified')}
              aria-label="Einspaltige Diff-Ansicht"
            >
              <Rows3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'split' ? 'secondary' : 'ghost'}
              isIconOnly
              onPress={() => setViewMode('split')}
              aria-label="Zweispaltige Diff-Ansicht"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card.Header>
      <Card.Content>
        {viewMode === 'split' ? (
          <SideBySideView detail={detail} />
        ) : (
          <ScrollShadow className="max-h-[28rem] rounded-lg bg-surface-secondary">
            <pre className="overflow-x-auto p-3 text-xs leading-5 whitespace-pre-wrap">
              {parsedLines.map((line, index) => {
                if ('hiddenCount' in line) {
                  return (
                    <div key={`collapsed-${index}`} className="border-y border-border/60 bg-surface px-3 py-1 text-center text-[11px] text-muted">
                      … {line.hiddenCount} unveränderte Zeilen ausgeblendet …
                    </div>
                  );
                }

                return (
                  <div key={`${line.kind}-${index}`} className={`grid grid-cols-[1rem_1fr] gap-2 px-3 py-0.5 font-mono ${getDiffClasses(line.kind)}`}>
                    {renderDiffLine(line, detail.language)}
                  </div>
                );
              })}
            </pre>
          </ScrollShadow>
        )}
      </Card.Content>
    </Card>
  );
}

