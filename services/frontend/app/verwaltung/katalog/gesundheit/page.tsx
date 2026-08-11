'use client';

import { Button, Card, Chip, ListBox, Select } from '@heroui/react';
import { Activity, AlertTriangle, CheckCircle2, CircleHelp, Clock3, ExternalLink, Link2, RefreshCw, ShieldAlert } from 'lucide-react';
import NextLink from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { getAppHealthIssueColor, getAppHealthIssueLabel } from '@/lib/appHealth';
import { getImageAssetUrl, isImageAssetSource } from '@/lib/assets';
import Image from 'next/image';

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

function healthColor(health: string): 'success' | 'warning' | 'danger' {
  if (health === 'critical') return 'danger';
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
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/10 text-xl">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="40px"
          className="object-contain p-1.5"
          unoptimized
          onError={() => setImageFailed(true)}
        />
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
      if (!response.ok) {
        throw new Error('Gesundheitsdaten konnten nicht geladen werden.');
      }
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
    if (filter === 'all') return data.apps;
    return data.apps.filter((app) => app.health === filter);
  }, [data, filter]);

  if (loading && !data) {
    return <div className="flex min-h-[40vh] items-center justify-center text-muted"><RefreshCw className="mr-2 h-5 w-5 animate-spin" />Gesundheitsdaten werden geladen…</div>;
  }

  if (error && !data) {
    return <div className="space-y-4"><p className="text-sm text-danger">{error}</p><Button variant="secondary" onPress={() => void loadHealth()}>Erneut versuchen</Button></div>;
  }

  if (!data) return null;

  const statCards = [
    { label: 'Gesund', value: data.healthy, icon: CheckCircle2, sub: 'Keine offenen Hinweise', iconColor: 'text-success', iconBackground: 'bg-success/10' },
    { label: 'Aufmerksamkeit', value: data.attention, icon: CircleHelp, sub: 'Apps mit Hinweisen', iconColor: 'text-warning', iconBackground: 'bg-warning/10' },
    { label: 'Kritisch', value: data.critical, icon: ShieldAlert, sub: 'Dringende Probleme', iconColor: 'text-danger', iconBackground: 'bg-danger/10' },
    { label: 'Live-Link-Probleme', value: data.linkProbeIssues, icon: Link2, sub: 'Erreichbarkeitsfehler', iconColor: 'text-danger', iconBackground: 'bg-danger/10' },
    { label: 'Sync-Probleme', value: data.syncIssues, icon: RefreshCw, sub: 'Repository-Synchronisation', iconColor: 'text-accent', iconBackground: 'bg-accent/10' },
    { label: 'Veraltet', value: data.staleDocumentation, icon: Clock3, sub: 'Älter als 90 Tage', iconColor: 'text-warning', iconBackground: 'bg-warning/10' },
    { label: 'Ohne Owner', value: data.unowned, icon: Activity, sub: 'Verantwortlichkeit fehlt', iconColor: 'text-warning', iconBackground: 'bg-warning/10' },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">Katalogbetrieb</p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">App-Gesundheit</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Link-Erreichbarkeit, Repository-Synchronisation, Dokumentationsstand und Verantwortlichkeiten an einem Ort.
          </p>
        </div>
        <Button variant="secondary" isPending={loading} onPress={() => void loadHealth()}>
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, sub, iconColor, iconBackground }) => (
          <div key={label} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase leading-4 tracking-wider text-muted">{label}</span>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBackground}`}>
                <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
              </div>
            </div>
            <span className="text-3xl font-bold leading-none text-foreground">{value}</span>
            <span className="text-xs leading-4 text-muted">{sub}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-surface-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{apps.length} von {data.total} Apps angezeigt</p>
          <p className="mt-1 text-xs text-muted">Letzte Prüfung: {relativeDate(data.generatedAt)}</p>
        </div>
        <Select aria-label="Gesundheitsfilter" selectedKey={filter} onSelectionChange={(key) => setFilter(String(key))} className="w-full sm:w-64">
          <Select.Trigger className="bg-field-background"><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="all" textValue="Alle Apps">Alle Apps <ListBox.ItemIndicator /></ListBox.Item>
              <ListBox.Item id="critical" textValue="Kritisch">Kritisch <ListBox.ItemIndicator /></ListBox.Item>
              <ListBox.Item id="attention" textValue="Aufmerksamkeit nötig">Aufmerksamkeit nötig <ListBox.ItemIndicator /></ListBox.Item>
              <ListBox.Item id="healthy" textValue="Gesund">Gesund <ListBox.ItemIndicator /></ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {apps.length === 0 ? (
        <Card variant="default" className="border-dashed border-border/70">
          <Card.Content className="flex flex-col items-center gap-3 p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="font-semibold text-foreground">Keine Apps in diesem Filter</p>
            <p className="text-sm text-muted">Die Katalogdaten sind aktuell unauffällig.</p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {apps.map((app) => (
            <Card key={app.appId} variant="default" className="border-border/70 shadow-sm">
              <Card.Header className="gap-3 border-b border-border/60 p-5">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <HealthAppIcon icon={app.icon} name={app.name} />
                    <div className="min-w-0">
                      <Card.Title className="truncate text-base">{app.name}</Card.Title>
                      <Card.Description className="mt-1 truncate">Owner: {app.ownerName || 'Nicht zugewiesen'}</Card.Description>
                    </div>
                  </div>
                  <Chip color={healthColor(app.health)} variant="soft" size="sm">{healthLabel(app.health)}</Chip>
                </div>
              </Card.Header>
              <Card.Content className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  {app.issues.length === 0 ? (
                    <Chip color="success" variant="soft" size="sm">Keine offenen Hinweise</Chip>
                  ) : app.issues.map((issue) => (
                    <Chip key={issue} color={getAppHealthIssueColor(issue)} variant="soft" size="sm">
                      {getAppHealthIssueLabel(issue)}
                    </Chip>
                  ))}
                </div>
                <div className="grid gap-3 text-xs text-muted sm:grid-cols-3">
                  <div><span className="block font-semibold text-foreground">Live-Link</span>{app.linkProbeStatus || 'unbekannt'}</div>
                  <div><span className="block font-semibold text-foreground">Repository</span>{app.syncStatus || 'unlinked'}</div>
                  <div><span className="block font-semibold text-foreground">Katalogänderung</span>{relativeDate(app.updatedAt)}</div>
                </div>
                {app.syncError && <p className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-xs text-danger">{app.syncError}</p>}
              </Card.Content>
              <Card.Footer className="justify-between border-t border-border/60 p-4">
                <span className="text-xs text-muted">Sync: {relativeDate(app.lastSyncedAt)}</span>
                <NextLink href={`/apps/${encodeURIComponent(app.appId)}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                  Details <ExternalLink className="h-3.5 w-3.5" />
                </NextLink>
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-2 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5" />Stale Dokumentation wird anhand von 90 Tagen ohne Katalogänderung markiert.</div>
    </div>
  );
}
