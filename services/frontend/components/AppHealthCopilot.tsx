'use client';

import { Button, Chip, Modal, Tooltip } from '@heroui/react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
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

function priorityColor(priority?: string): 'success' | 'warning' | 'danger' {
  if (priority === 'high') return 'danger';
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

  return (
    <Modal>
      <Tooltip delay={0}>
        <Tooltip.Trigger>
          <Button
            size="sm"
            variant="secondary"
            isIconOnly={props.iconOnly}
            onPress={openCopilot}
            aria-label={props.iconOnly ? `AI erklären: ${props.appName}` : undefined}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {!props.iconOnly && (props.triggerLabel || 'AI erklären')}
          </Button>
        </Tooltip.Trigger>
        {props.iconOnly && <Tooltip.Content placement="top">Gesundheitsprobleme mit AI erklären</Tooltip.Content>}
      </Tooltip>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container size="lg">
          <Modal.Dialog className="max-h-[min(760px,calc(100vh-2rem))] w-full overflow-hidden">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-accent">
                <Sparkles className="h-5 w-5" />
              </Modal.Icon>
              <div className="min-w-0">
                <Modal.Heading>Health Copilot</Modal.Heading>
                <p className="mt-1 truncate text-xs text-muted">{props.appName}</p>
              </div>
            </Modal.Header>
            <Modal.Body className="max-h-[65vh] space-y-5 overflow-y-auto">
              <section className="rounded-2xl border border-border bg-surface-secondary/50 p-4">
                <div className="flex items-start gap-3">
                  {props.issues.length > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{props.issues.length > 0 ? 'Offene Hinweise' : 'Keine offenen Hinweise'}</p>
                    <div className="mt-3 space-y-3">
                      {props.issues.length > 0 ? props.issues.map((issue) => (
                        <div key={issue} className="rounded-xl border border-border bg-surface p-3">
                          <p className="text-sm font-semibold text-foreground">{getAppHealthIssueLabel(issue)}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">{getAppHealthIssueDescription(issue)}</p>
                          {localEvidence(issue, props) && <p className="mt-2 text-xs text-muted"><span className="font-semibold text-foreground">Beleg:</span> {localEvidence(issue, props)}</p>}
                        </div>
                      )) : <p className="text-sm leading-relaxed text-muted">Der aktuelle Katalogzustand ist unauffällig.</p>}
                    </div>
                  </div>
                </div>
              </section>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" />AI formuliert eine verständliche Einordnung …</div>
              )}
              {error && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{error}</p>}
              {suggestion && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">Einordnung</p>
                    <Chip color={priorityColor(suggestion.priority)} variant="soft" size="sm">{priorityLabel(suggestion.priority)}</Chip>
                  </div>
                  <p className="rounded-xl border border-border bg-surface-secondary/50 p-4 text-sm leading-relaxed text-foreground">{suggestion.summary}</p>
                  {suggestion.issues.map((issue) => (
                    <div key={issue.code} className="rounded-2xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{issue.title}</p>
                          <p className="mt-1 text-xs text-muted">{getAppHealthIssueLabel(issue.code)}</p>
                        </div>
                        <Chip color="warning" variant="soft" size="sm">Hinweis</Chip>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted">{issue.explanation}</p>
                      {issue.evidence && <p className="mt-3 text-xs text-muted"><span className="font-semibold text-foreground">Beleg:</span> {issue.evidence}</p>}
                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted">Nächste Schritte</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                          {issue.actions.map((action) => <li key={action}>{action}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
