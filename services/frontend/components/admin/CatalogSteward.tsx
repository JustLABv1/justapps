'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Sheet } from '@/components/panelui/sheet';
import { Spinner } from '@/components/panelui/spinner';
import { runCatalogSteward, type CatalogStewardFinding, type CatalogStewardReport } from '@/lib/ai';
import { ArrowUpRight, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';

const SEVERITY = {
  high: { label: 'Hoch', variant: 'destructive' },
  medium: { label: 'Mittel', variant: 'warning' },
  low: { label: 'Niedrig', variant: 'secondary' },
} as const;

function Finding({ finding }: { finding: CatalogStewardFinding }) {
  const severity = SEVERITY[finding.severity as keyof typeof SEVERITY] ?? SEVERITY.low;
  return (
    <article className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{finding.appName}</span>
          <h3 className="font-medium">{finding.title}</h3>
        </div>
        <Badge variant={severity.variant} size="sm">{severity.label}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{finding.summary}</p>
      {finding.evidence.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Beleg</span>
          <ul className="list-disc ps-4 text-sm">
            {finding.evidence.map((evidence, index) => <li key={`${evidence}-${index}`}>{evidence}</li>)}
          </ul>
        </div>
      )}
      {finding.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Nächste Schritte</span>
          <ul className="list-disc ps-4 text-sm">
            {finding.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`}>{suggestion}</li>)}
          </ul>
        </div>
      )}
      {finding.relatedAppIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Vergleichen mit: <span className="font-mono text-foreground">{finding.relatedAppIds.join(', ')}</span>
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="self-end"
        render={<NextLink href={`/verwaltung/katalog/apps/${encodeURIComponent(finding.appId)}/edit`} />}
      >
        App bearbeiten
        <ArrowUpRight />
      </Button>
    </article>
  );
}

/**
 * The AI review of the catalog, opened from a button and read in a side panel.
 * It only reports: nothing in the catalog changes until someone edits an app.
 */
export function CatalogSteward() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<CatalogStewardReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      setReport(await runCatalogSteward());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Katalogprüfung konnte nicht erstellt werden.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // The first opening starts a review; later ones show the last result.
        if (next && !report && !pending) void run();
      }}
      side="right"
    >
      <Sheet.Trigger render={<Button variant="secondary" />}>
        <Sparkles />
        KI-Katalogprüfung
      </Sheet.Trigger>
      <Sheet.Content className="sm:max-w-xl">
        <Sheet.Header
          title="KI-Katalogprüfung"
          description="Findet belegbare Lücken, veraltete Einträge und mögliche Dubletten. Geändert wird nichts automatisch."
        />
        <Sheet.Body className="flex flex-col gap-4 px-6 pb-6">
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
          {pending ? (
            <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
              <Spinner />
              Der Katalog wird geprüft … das kann einen Moment dauern.
            </div>
          ) : report ? (
            <>
              <div className="flex flex-col gap-1 rounded-xl bg-muted/50 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {report.appsScanned} Apps geprüft · {new Date(report.generatedAt).toLocaleString('de-DE')}
                </span>
                <p className="text-sm">{report.summary}</p>
              </div>
              {report.findings.length > 0 ? (
                report.findings.map((finding, index) => (
                  <Finding key={`${finding.appId}-${finding.kind}-${index}`} finding={finding} />
                ))
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="font-medium">Keine belegbaren Befunde</p>
                  <p className="max-w-sm text-sm text-muted-foreground">Der Katalog ist aktuell unauffällig.</p>
                </div>
              )}
            </>
          ) : null}
        </Sheet.Body>
        <Sheet.Footer>
          <Button variant="secondary" loading={pending} onClick={() => void run()}>
            <RefreshCw />
            Erneut prüfen
          </Button>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}
