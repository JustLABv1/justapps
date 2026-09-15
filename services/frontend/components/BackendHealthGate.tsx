'use client';

import { Button, Card, Spinner } from '@heroui/react';
import { CloudOff, Database, Network, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '@/lib/apiUrl';

type BackendState = 'checking' | 'available' | 'unavailable';

const RETRY_INTERVAL_MS = 10_000;
const HEALTH_TIMEOUT_MS = 5_000;

const SYSTEM_STATUS_ITEMS = [
  { label: 'API Gateway', icon: Network, position: 'left-[7%] top-[16%]', animation: 'maintenance-float-a 7s -1s' },
  { label: 'Datenbank', icon: Database, position: 'right-[8%] top-[22%]', animation: 'maintenance-float-b 8.5s -3s' },
  { label: 'Anwendungsserver', icon: Server, position: 'bottom-[17%] left-[10%]', animation: 'maintenance-float-b 9s -5s' },
  { label: 'Verbindung', icon: CloudOff, position: 'bottom-[13%] right-[9%]', animation: 'maintenance-float-a 7.5s -2s' },
] as const;

export function BackendHealthGate({ children }: { children: React.ReactNode }) {
  const [backendState, setBackendState] = useState<BackendState>('checking');
  const [isRetrying, setIsRetrying] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const checkBackend = useCallback(async (showPendingState = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    if (showPendingState) setIsRetrying(true);
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`${getApiUrl()}/health`, {
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      });
      const data = response.ok
        ? await response.json().catch(() => null) as { status?: string } | null
        : null;
      setBackendState(response.ok && data?.status === 'ok' ? 'available' : 'unavailable');
    } catch {
      if (!controller.signal.aborted || requestRef.current === controller) {
        setBackendState('unavailable');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsRetrying(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialCheckId = window.setTimeout(() => void checkBackend(), 0);

    const markUnavailable = () => setBackendState('unavailable');
    const retryWhenOnline = () => void checkBackend(true);
    window.addEventListener('backend:unavailable', markUnavailable);
    window.addEventListener('online', retryWhenOnline);

    return () => {
      window.clearTimeout(initialCheckId);
      requestRef.current?.abort();
      window.removeEventListener('backend:unavailable', markUnavailable);
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [checkBackend]);

  useEffect(() => {
    if (backendState !== 'unavailable') return;
    const intervalId = window.setInterval(() => void checkBackend(), RETRY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [backendState, checkBackend]);

  if (backendState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Verbindung wird geprüft">
        <Spinner size="lg" />
      </div>
    );
  }

  if (backendState === 'unavailable') {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div aria-hidden="true" className="maintenance-glow absolute -top-48 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {SYSTEM_STATUS_ITEMS.map(({ label, icon: Icon, position, animation }) => (
          <div
            key={label}
            aria-hidden="true"
            className={`maintenance-float absolute hidden items-center gap-2 rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-xs font-medium text-muted shadow-md shadow-black/5 backdrop-blur-md sm:flex ${position}`}
            style={{ animation }}
          >
            <Icon className="size-4 text-accent" />
            {label}
            <span className="size-1.5 rounded-full bg-warning" />
          </div>
        ))}

        <Card className="maintenance-card relative w-full max-w-xl border border-border/70 bg-surface/95 shadow-xl">
          <Card.Header className="items-center gap-5 text-center">
            <div className="maintenance-icon flex size-16 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <CloudOff aria-hidden="true" className="size-8" />
            </div>
            <div className="maintenance-copy space-y-2">
              <Card.Title className="text-2xl sm:text-3xl">Wir sind gleich wieder da</Card.Title>
              <Card.Description className="mx-auto max-w-md text-base leading-6">
                Die Plattform kann den Server momentan nicht erreichen. Möglicherweise werden gerade Wartungsarbeiten durchgeführt.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content className="maintenance-notice">
            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-secondary p-4 text-sm text-muted">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
              <p>Ihre Daten sind sicher. Die Verbindung wird automatisch alle zehn Sekunden erneut geprüft.</p>
            </div>
          </Card.Content>
          <Card.Footer className="maintenance-action justify-center">
            <Button
              variant="primary"
              isPending={isRetrying}
              onPress={() => void checkBackend(true)}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Erneut versuchen
            </Button>
          </Card.Footer>
        </Card>
      </main>
    );
  }

  return children;
}
