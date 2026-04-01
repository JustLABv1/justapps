import { Tooltip } from '@heroui/react';
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

export function LinkStatusDot({ status }: { status?: string }) {
  const resolvedStatus = normalizeProbeStatus(status);

  const dotClass = {
    ok: 'bg-success',
    partial: 'bg-warning',
    down: 'bg-danger',
    unknown: 'bg-muted/40',
  }[resolvedStatus];

  const label = {
    ok: 'Alle Live-Endpunkte erreichbar',
    partial: 'Mindestens ein Live-Endpunkt ist nicht erreichbar',
    down: 'Keine Live-Endpunkte erreichbar',
    unknown: 'Noch kein Backend-Status vorhanden',
  }[resolvedStatus];

  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger>
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <span className="text-xs">{label}</span>
      </Tooltip.Content>
    </Tooltip>
  );
}
