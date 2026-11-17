'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Dialog } from '@/components/panelui/dialog';
import { Spinner } from '@/components/panelui/spinner';
import { Tooltip } from '@/components/panelui/tooltip';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { explainAppHealth, type HealthCopilotSuggestion } from '@/lib/ai';
import { getAppHealthIssueDescription, getAppHealthIssueLabel } from '@/lib/appHealth';

interface AppHealthCopilotProps {
  appId: string;
  appName: string;
  issues: string[];
  linkProbeStatus?: string;
  syncStatus?: string;
  syncError?: string;
  triggerLabel?: string;
  iconOnly?: boolean;
}

function priorityLabel(priority?: string) {
  if (priority === 'high') return 'Hohe Priorität';
  if (priority === 'medium') return 'Mittlere Priorität';
  return 'Niedrige Priorität';
}

function priorityColor(priority?: string): 'success' | 'warning' | 'destructive' {
  if (priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'success';
}

function localEvidence(issue: string, props: AppHealthCopilotProps) {
  if (issue === 'repository-sync-error' && props.syncError) return props.syncError;
  if (issue === 'link-probe-down' || issue === 'link-probe-partial') {
    return `Live-Link-Status: ${props.linkProbeStatus || 'unbekannt'}`;
  }
  if (issue === 'repository-sync-error' || issue === 'repository-sync-pending') {
    return `Repository-Sync-Status: ${props.syncStatus || 'unbekannt'}`;
  }
  return undefined;
}

export function AppHealthCopilot(props: AppHealthCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<HealthCopilotSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCopilot() {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    explainAppHealth(props.appId)
      .then((value) => {
        if (active) setSuggestion(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'AI-Erklärung konnte nicht erzeugt werden.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, props.appId]);

  const trigger = (
    <Button size="sm" variant="outline" onClick={openCopilot} aria-label={props.iconOnly ? `Hinweise zu ${props.appName} mit AI erklären` : undefined}>
      <Sparkles />
      {!props.iconOnly && (props.triggerLabel || 'AI erklären')}
    </Button>
  );

  return (
    <>
      {props.iconOnly ? (
        <Tooltip>
          <Tooltip.Trigger render={<Button size="icon-sm" variant="outline" onClick={openCopilot} aria-label={`Hinweise zu ${props.appName} mit AI erklären`} />}>
            <Sparkles />
          </Tooltip.Trigger>
          <Tooltip.Content>Hinweise mit AI erklären</Tooltip.Content>
        </Tooltip>
      ) : trigger}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content size="lg">
          <Dialog.Header title="Health Copilot" description={props.appName} />
          <Dialog.Body>
            <section className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-medium">
                {props.issues.length > 0 ? <AlertTriangle className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}
                {props.issues.length > 0 ? 'Offene Hinweise' : 'Keine offenen Hinweise'}
              </p>
              {props.issues.length > 0 ? props.issues.map((issue) => (
                <div key={issue} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{getAppHealthIssueLabel(issue)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{getAppHealthIssueDescription(issue)}</p>
                  {localEvidence(issue, props) && <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Beleg:</span> {localEvidence(issue, props)}</p>}
                </div>
              )) : <p className="text-sm text-muted-foreground">Der aktuelle Katalogzustand ist unauffällig.</p>}
            </section>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner />AI formuliert eine verständliche Einordnung …</div>
            )}
            {error && (
              <Alert variant="plain" tone="warning">
                <Alert.Icon />
                <Alert.Title>{error}</Alert.Title>
              </Alert>
            )}
            {suggestion && (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Einordnung</p>
                  <Badge variant={priorityColor(suggestion.priority)} size="sm">{priorityLabel(suggestion.priority)}</Badge>
                </div>
                <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">{suggestion.summary}</p>
                {suggestion.issues.map((issue) => (
                  <div key={issue.code} className="rounded-xl border p-4">
                    <p className="font-medium">{issue.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{getAppHealthIssueLabel(issue.code)}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{issue.explanation}</p>
                    {issue.evidence && <p className="mt-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">Beleg:</span> {issue.evidence}</p>}
                    <p className="mt-3 text-xs font-medium text-muted-foreground">Nächste Schritte</p>
                    <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm">
                      {issue.actions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                  </div>
                ))}
              </section>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
