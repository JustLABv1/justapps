'use client';

import { Tooltip } from '@heroui/react';
import { useEffect, useState } from 'react';

type ProbeState = 'loading' | 'up' | 'down' | 'unknown';

interface ProbeResult {
  ok: boolean;
  status: number;
  latency: number;
}

export function LinkStatusDot({ url }: { url: string }) {
  const [state, setState] = useState<ProbeState>('loading');
  const [result, setResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/probe?url=${encodeURIComponent(url)}`)
      .then(res => res.ok ? res.json() as Promise<ProbeResult> : null)
      .then((data) => {
        if (cancelled) return;
        if (!data) { setState('unknown'); return; }
        setResult(data);
        setState(data.ok ? 'up' : 'down');
      })
      .catch(() => {
        if (!cancelled) setState('unknown');
      });
    return () => { cancelled = true; };
  }, [url]);

  const dotClass = {
    loading: 'bg-muted/40 animate-pulse',
    up: 'bg-success',
    down: 'bg-danger',
    unknown: 'bg-warning',
  }[state];

  const label = {
    loading: 'Erreichbarkeit wird geprüft…',
    up: result ? `Erreichbar (${result.latency} ms)` : 'Erreichbar',
    down: result?.status === 0
      ? 'Timeout — nicht erreichbar'
      : `Nicht erreichbar (HTTP ${result?.status ?? ''})`,
    unknown: 'Status unbekannt',
  }[state];

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
