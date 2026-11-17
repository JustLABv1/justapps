'use client';

import type { ReleaseChangeDetail } from '@/config/apps';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
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
          <span className="text-primary">{match[1]}</span>
          <span className="text-warning">{match[2]}</span>
        </>
      );
    }
    if (line.trimStart().startsWith('- ')) {
      const prefix = line.slice(0, line.indexOf('- ') + 2);
      const rest = line.slice(line.indexOf('- ') + 2);
      return (
        <>
          <span className="text-primary">{prefix}</span>
          <span className="text-warning">{rest}</span>
        </>
      );
    }
  }

  if (language === 'markdown') {
    if (line.startsWith('#')) {
      return <span className="font-semibold text-primary">{line}</span>;
    }
    if (line.trimStart().startsWith('- ') || line.trimStart().startsWith('* ')) {
      return <span className="text-primary">{line}</span>;
    }
    if (line.startsWith('```')) {
      return <span className="text-success">{line}</span>;
    }
  }

  return <span>{line}</span>;
}

function renderDiffLine(line: DiffLine, language: string) {
  const marker = line.kind === 'context' ? ' ' : line.text.slice(0, 1);
  const content = line.kind === 'context' ? line.text : line.text.slice(1);
  const markerClass =
    line.kind === 'add'
      ? 'font-bold text-success'
      : line.kind === 'remove'
        ? 'font-bold text-destructive'
        : line.kind === 'meta'
          ? 'text-primary'
          : 'text-muted-foreground';

  return (
    <>
      <span className={`select-none ${markerClass}`}>{marker}</span>
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
      return 'border-s-2 border-success/60 bg-success/10 text-success';
    case 'remove':
      return 'border-s-2 border-destructive/60 bg-destructive/10 text-destructive';
    case 'meta':
      return 'border-s-2 border-primary/60 bg-primary/10 text-primary';
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
    <div className="max-w-full overflow-x-auto">
      <div className="min-w-[760px] overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-2 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="border-r border-border px-3 py-2">Vorher</div>
          <div className="px-3 py-2">Nachher</div>
        </div>
        <div className="grid grid-cols-2">
          <div className="border-r border-destructive/20 bg-destructive/5">
            {rows.map((row, index) => (
              <div key={`before-${index}`} className="border-t border-destructive/15 px-3 py-1.5 font-mono text-xs whitespace-pre-wrap">
                {tokenizeLine(row.before, detail.language)}
              </div>
            ))}
          </div>
          <div className="bg-success/5">
            {rows.map((row, index) => (
              <div key={`after-${index}`} className="border-t border-success/15 px-3 py-1.5 font-mono text-xs whitespace-pre-wrap">
                {tokenizeLine(row.after, detail.language)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReleaseDiffViewer({ detail }: { detail: ReleaseChangeDetail }) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(shouldShowSideBySide(detail) ? 'split' : 'unified');
  const parsedLines = useMemo(() => collapseLines(parseUnifiedDiff(detail.diff)), [detail.diff]);
  const sideBySideAllowed = shouldShowSideBySide(detail);

  return (
    <Card>
      <Card.Header>
        <Card.Title as="h4" className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" size="sm">{detail.area}</Badge>
          {detail.label}
        </Card.Title>
        {detail.preview && <Card.Description>{detail.preview}</Card.Description>}
        {sideBySideAllowed && (
          <Card.Action className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant={viewMode === 'unified' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('unified')}
              aria-label="Einspaltige Diff-Ansicht"
              aria-pressed={viewMode === 'unified'}
            >
              <Rows3 />
            </Button>
            <Button
              size="icon-sm"
              variant={viewMode === 'split' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('split')}
              aria-label="Zweispaltige Diff-Ansicht"
              aria-pressed={viewMode === 'split'}
            >
              <Columns2 />
            </Button>
          </Card.Action>
        )}
      </Card.Header>
      <Card.Content>
        {viewMode === 'split' ? (
          <SideBySideView detail={detail} />
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-lg bg-muted/50">
            <pre className="overflow-x-auto p-3 text-xs leading-5 whitespace-pre-wrap">
              {parsedLines.map((line, index) => {
                if ('hiddenCount' in line) {
                  return (
                    <div key={`collapsed-${index}`} className="border-y border-border/60 bg-background px-3 py-1 text-center text-[11px] text-muted-foreground">
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
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
