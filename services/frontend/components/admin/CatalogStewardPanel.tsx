'use client';

import { Button, Card, Chip, Modal } from '@heroui/react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { runCatalogSteward, type CatalogStewardFinding, type CatalogStewardReport } from '@/lib/ai';

function severityLabel(severity: string) {
  if (severity === 'high') return 'Hoch';
  if (severity === 'medium') return 'Mittel';
  return 'Niedrig';
}

function severityColor(severity: string): 'danger' | 'warning' | 'success' {
  if (severity === 'high') return 'danger';
  if (severity === 'medium') return 'warning';
  return 'success';
}

function findingCountLabel(count: number) {
  return `${count} ${count === 1 ? 'Befund' : 'Befunde'}`;
}

function FindingCard({ finding, onEdit }: { finding: CatalogStewardFinding; onEdit: (appId: string) => void }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{finding.appName}</p>
          <h3 className="mt-1 font-semibold text-foreground">{finding.title}</h3>
        </div>
        <Chip color={severityColor(finding.severity)} variant="soft" size="sm">{severityLabel(finding.severity)}</Chip>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{finding.summary}</p>
      {finding.evidence.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-surface-secondary/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Beleg</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {finding.evidence.map((evidence, index) => <li key={`${evidence}-${index}`}>{evidence}</li>)}
          </ul>
        </div>
      )}
      {finding.suggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Nächste Schritte</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {finding.suggestions.map((suggestion, index) => <li key={`${suggestion}-${index}`}>{suggestion}</li>)}
          </ul>
        </div>
      )}
      {finding.relatedAppIds.length > 0 && <p className="mt-3 text-xs text-muted">Vergleichskandidaten: <span className="font-mono text-foreground">{finding.relatedAppIds.join(', ')}</span></p>}
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="ghost" onPress={() => onEdit(finding.appId)}>
          App bearbeiten <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}

export function CatalogStewardPanel() {
  const router = useRouter();
  const [report, setReport] = useState<CatalogStewardReport | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReview = async () => {
    setIsPending(true);
    setError(null);
    try {
      const nextReport = await runCatalogSteward();
      setReport(nextReport);
      setIsOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI-Katalogprüfung konnte nicht erzeugt werden.');
    } finally {
      setIsPending(false);
    }
  };

  const editApp = (appId: string) => {
    setIsOpen(false);
    router.push(`/verwaltung/katalog/apps/${encodeURIComponent(appId)}/edit`);
  };

  const findingCount = report?.findings.length ?? 0;

  return (
    <>
      <Card variant="default" className="mb-6 border-border shadow-sm">
        <Card.Header className="flex flex-col gap-4 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <Card.Title>AI Catalog Steward</Card.Title>
              <Card.Description className="mt-1">Findet belegbare Lücken, veraltete Einträge und mögliche Dubletten im App-Katalog.</Card.Description>
            </div>
          </div>
          <Button variant="secondary" size="sm" onPress={() => void runReview()} isPending={isPending}>
            {report ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {report ? 'Erneut prüfen' : 'Katalog prüfen'}
          </Button>
        </Card.Header>
        <Card.Content className="p-5">
          {error && <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
          {report ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {findingCount > 0 ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
                <div>
                  <p className="font-semibold text-foreground">{findingCount > 0 ? `${findingCountLabel(findingCount)} zur Prüfung` : 'Keine belegbaren Befunde'}</p>
                  <p className="mt-1 text-sm text-muted">{report.appsScanned} Apps geprüft · {new Date(report.generatedAt).toLocaleString('de-DE')}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onPress={() => setIsOpen(true)}>Details anzeigen <ArrowUpRight className="h-3.5 w-3.5" /></Button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted">Die Prüfung ist review-only: Der Steward ändert keine Apps automatisch und verlinkt jeden Befund direkt zur Bearbeitung.</p>
          )}
        </Card.Content>
      </Card>

      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Modal.Container size="lg">
            <Modal.Dialog className="max-h-[min(820px,calc(100vh-2rem))] w-full overflow-hidden">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-accent/10 text-accent"><Sparkles className="h-5 w-5" /></Modal.Icon>
                <div className="min-w-0">
                  <Modal.Heading>AI Catalog Steward</Modal.Heading>
                  <p className="mt-1 text-xs text-muted">Konkrete Hinweise für die Katalogpflege</p>
                </div>
              </Modal.Header>
              <Modal.Body className="max-h-[68vh] space-y-5 overflow-y-auto">
                {report && <>
                  <div className="rounded-2xl border border-border bg-surface-secondary/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Zusammenfassung</p>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{report.summary}</p>
                  </div>
                  {report.findings.length > 0 ? report.findings.map((finding, index) => <FindingCard key={`${finding.appId}-${finding.kind}-${index}`} finding={finding} onEdit={editApp} />) : (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/20 bg-success/5 p-8 text-center">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                      <p className="font-semibold text-foreground">Der Katalog ist aktuell unauffällig.</p>
                      <p className="max-w-md text-sm leading-relaxed text-muted">Es wurden keine belastbaren Hinweise gefunden. Die Prüfung kann jederzeit erneut gestartet werden.</p>
                    </div>
                  )}
                </>}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
