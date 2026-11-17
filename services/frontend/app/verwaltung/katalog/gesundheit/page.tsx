'use client';

import { AppHealthCopilot } from '@/components/AppHealthCopilot';
import { Alert } from '@/components/panelui/alert';
import { Badge, type BadgeVariant } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Stat } from '@/components/panelui/stat';
import { Tabs } from '@/components/panelui/tabs';
import { fetchApi } from '@/lib/api';
import { getAppHealthIssueColor, getAppHealthIssueLabel } from '@/lib/appHealth';
import { getImageAssetUrl, isImageAssetSource } from '@/lib/assets';
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface AppHealthRow {
  appId: string;
  name: string;
  icon?: string;
  status?: string;
  ownerName?: string;
  linkProbeStatus?: string;
  syncStatus?: string;
  syncError?: string;
  lastSyncedAt?: string;
  updatedAt: string;
  health: 'healthy' | 'attention' | 'critical' | string;
  issues: string[];
}

interface HealthResponse {
  generatedAt: string;
  total: number;
  healthy: number;
  attention: number;
  critical: number;
  linkProbeIssues: number;
  syncIssues: number;
  staleDocumentation: number;
  unowned: number;
  apps: AppHealthRow[];
}

function healthLabel(health: string) {
  if (health === 'critical') return 'Kritisch';
  if (health === 'attention') return 'Aufmerksamkeit nötig';
  return 'Gesund';
}

function healthVariant(health: string): BadgeVariant {
  if (health === 'critical') return 'destructive';
  if (health === 'attention') return 'warning';
  return 'success';
}

function relativeDate(value?: string) {
  if (!value) return 'nie';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unbekannt';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function HealthAppIcon({ icon, name }: { icon?: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = imageFailed ? null : getImageAssetUrl(icon);
  const fallback = icon && !isImageAssetSource(icon) ? icon : '🏛️';

  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xl">
      {imageSrc ? (
        <Image src={imageSrc} alt="" fill sizes="40px" className="object-contain p-1.5" unoptimized onError={() => setImageFailed(true)} />
      ) : (
        <span aria-label={`${name} Symbol`} role="img" className="leading-none">{fallback}</span>
      )}
    </span>
  );
}

export default function VerwaltungKatalogGesundheitPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApi('/admin/health', { cache: 'no-store' });
      if (!response.ok) throw new Error('Gesundheitsdaten konnten nicht geladen werden.');
      setData(await response.json() as HealthResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gesundheitsdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadHealth(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadHealth]);

  const apps = useMemo(() => {
    if (!data) return [];
    return filter === 'all' ? data.apps : data.apps.filter((app) => app.health === filter);
  }, [data, filter]);

  if (loading && !data) {
    return <p role="status" className="py-16 text-center text-sm text-muted-foreground">Gesundheitsdaten werden geladen …</p>;
  }

  if (error && !data) {
    return (
      <Alert variant="plain" tone="destructive">
        <Alert.Icon />
        <Alert.Title>{error}</Alert.Title>
        <Alert.Actions><Button size="sm" variant="secondary" onClick={() => void loadHealth()}>Erneut versuchen</Button></Alert.Actions>
      </Alert>
    );
  }

  if (!data) return null;

  const figures = [
    { label: 'Gesund', value: data.healthy, sub: 'Keine offenen Hinweise' },
    { label: 'Aufmerksamkeit', value: data.attention, sub: 'Apps mit Hinweisen' },
    { label: 'Kritisch', value: data.critical, sub: 'Dringende Probleme' },
    { label: 'Live-Link-Probleme', value: data.linkProbeIssues, sub: 'Erreichbarkeitsfehler' },
    { label: 'Sync-Probleme', value: data.syncIssues, sub: 'Repository-Synchronisation' },
    { label: 'Veraltet', value: data.staleDocumentation, sub: 'Älter als 90 Tage' },
    { label: 'Ohne Owner', value: data.unowned, sub: 'Verantwortlichkeit fehlt' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">App-Gesundheit</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Link-Erreichbarkeit, Repository-Synchronisation, Dokumentationsstand und Verantwortlichkeiten an einem Ort.
            Letzte Prüfung: {relativeDate(data.generatedAt)}.
          </p>
        </div>
        <Button variant="secondary" className="shrink-0" loading={loading} onClick={() => void loadHealth()}>
          <RefreshCw />
          Aktualisieren
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map((figure) => (
          <Card key={figure.label} size="sm">
            <Card.Content>
              <Stat className="flex-col items-start gap-1">
                <Stat.Content>
                  <Stat.Label>{figure.label}</Stat.Label>
                  <Stat.Value size="md">{figure.value}</Stat.Value>
                </Stat.Content>
                <span className="text-xs text-muted-foreground">{figure.sub}</span>
              </Stat>
            </Card.Content>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(String(value))}>
          <Tabs.List aria-label="Gesundheitsfilter">
            <Tabs.Trigger value="all">Alle <Tabs.Badge>{data.total}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="critical">Kritisch <Tabs.Badge>{data.critical}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="attention">Aufmerksamkeit <Tabs.Badge>{data.attention}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="healthy">Gesund <Tabs.Badge>{data.healthy}</Tabs.Badge></Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <p className="text-sm text-muted-foreground">{apps.length} von {data.total} Apps</p>
      </div>

      {apps.length === 0 ? (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <p className="font-medium">Keine Apps in diesem Filter</p>
            <p className="text-sm text-muted-foreground">Die Katalogdaten sind aktuell unauffällig.</p>
          </Card.Content>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {apps.map((app) => (
              <li key={app.appId} className="@container flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <HealthAppIcon icon={app.icon} name={app.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{app.name}</p>
                      <p className="truncate text-sm text-muted-foreground">Owner: {app.ownerName || 'Nicht zugewiesen'}</p>
                    </div>
                  </div>
                  <Badge variant={healthVariant(app.health)} size="sm" className="shrink-0">{healthLabel(app.health)}</Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {app.issues.length === 0 ? (
                    <Badge variant="success" size="sm">Keine offenen Hinweise</Badge>
                  ) : app.issues.map((issue) => (
                    <Badge key={issue} variant={getAppHealthIssueColor(issue) === 'danger' ? 'destructive' : 'warning'} size="sm">
                      {getAppHealthIssueLabel(issue)}
                    </Badge>
                  ))}
                </div>

                <dl className="grid gap-3 text-xs sm:grid-cols-3">
                  <div><dt className="font-medium">Live-Link</dt><dd className="text-muted-foreground">{app.linkProbeStatus || 'unbekannt'}</dd></div>
                  <div><dt className="font-medium">Repository</dt><dd className="text-muted-foreground">{app.syncStatus || 'unlinked'}</dd></div>
                  <div><dt className="font-medium">Katalogänderung</dt><dd className="text-muted-foreground">{relativeDate(app.updatedAt)}</dd></div>
                </dl>

                {app.syncError && (
                  <Alert variant="plain" tone="destructive">
                    <Alert.Icon />
                    <Alert.Title>{app.syncError}</Alert.Title>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Sync: {relativeDate(app.lastSyncedAt)}</span>
                  <div className="flex items-center gap-2">
                    {app.issues.length > 0 && (
                      <AppHealthCopilot
                        appId={app.appId}
                        appName={app.name}
                        issues={app.issues}
                        linkProbeStatus={app.linkProbeStatus}
                        syncStatus={app.syncStatus}
                        syncError={app.syncError}
                      />
                    )}
                    <Button variant="ghost" size="sm" render={<NextLink href={`/apps/${encodeURIComponent(app.appId)}`} />}>
                      Details
                      <ExternalLink />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">Veraltete Dokumentation wird anhand von 90 Tagen ohne Katalogänderung markiert.</p>
    </div>
  );
}
