'use client';

import { Tooltip, type TooltipTone } from '@/components/panelui/tooltip';

type ProbeStatus = 'ok' | 'partial' | 'down' | 'unknown';

function normalizeProbeStatus(status: string | undefined): ProbeStatus {
  switch (status) {
    case 'ok':
    case 'partial':
    case 'down':
      return status;
    default:
      return 'unknown';
  }
}

const STATUS: Record<ProbeStatus, { label: string; tone: TooltipTone; dot: string }> = {
  ok: { label: 'Alle Live-Endpunkte erreichbar', tone: 'success', dot: 'bg-success' },
  partial: { label: 'Mindestens ein Live-Endpunkt ist nicht erreichbar', tone: 'warning', dot: 'bg-warning' },
  down: { label: 'Keine Live-Endpunkte erreichbar', tone: 'destructive', dot: 'bg-destructive' },
  unknown: { label: 'Noch kein Backend-Status vorhanden', tone: 'info', dot: 'bg-muted-foreground/40' },
};

/**
 * The reachability of an app's live endpoints, as a dot with a tooltip.
 * It sits inside links and menu items, so the trigger is a plain span rather
 * than a button, and the status is also written out for screen readers.
 */
export function LinkStatusDot({ status }: { status?: string }) {
  const { label, tone, dot } = STATUS[normalizeProbeStatus(status)];

  return (
    <Tooltip>
      <Tooltip.Trigger render={<span className="inline-flex shrink-0 items-center" />}>
        <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
        <span className="sr-only">{label}</span>
      </Tooltip.Trigger>
      <Tooltip.Content variant="tone" tone={tone}>
        {label}
      </Tooltip.Content>
    </Tooltip>
  );
}
