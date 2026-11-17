'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge, type BadgeVariant } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Input } from '@/components/panelui/input';
import { Stat } from '@/components/panelui/stat';
import { Table } from '@/components/panelui/table';
import { Tabs } from '@/components/panelui/tabs';
import { Tooltip } from '@/components/panelui/tooltip';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { getImageAssetUrl } from '@/lib/assets';
import { toast } from '@/lib/toast';
import { ExternalLink, GitBranch, Pencil, RefreshCw, Search } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type SyncStatusKey = 'success' | 'warning' | 'pending_approval' | 'error' | 'never';

const SYNC_META: Record<SyncStatusKey | string, { label: string; variant: BadgeVariant }> = {
  success: { label: 'Synchronisiert', variant: 'success' },
  warning: { label: 'Mit Hinweisen', variant: 'warning' },
  pending_approval: { label: 'Wartet auf Freigabe', variant: 'warning' },
  error: { label: 'Fehler', variant: 'destructive' },
  never: { label: 'Noch nicht synchronisiert', variant: 'secondary' },
};

function getSyncMeta(status?: string | null) {
  if (!status) return SYNC_META.never;
  return SYNC_META[status] ?? SYNC_META.never;
}

function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Nie';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
}

const PROVIDER_TYPE_LABEL: Record<string, string> = { gitlab: 'GitLab', github: 'GitHub' };

function providerTypeLabel(type?: string | null): string {
  if (!type) return '';
  return PROVIDER_TYPE_LABEL[type] || type;
}

export default function RepositorySyncPage() {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const handleSyncNow = async (appId: string) => {
    setSyncingIds((prev) => new Set(prev).add(appId));
    try {
      const res = await fetchApi(`/apps/${appId}/repository/sync`, { method: 'POST' });
      if (res.ok) {
        const refreshed = await fetchApi('/apps');
        if (refreshed.ok) setApps(await refreshed.json());
        toast.success('Synchronisierung abgeschlossen.');
      } else {
        toast.danger('Die Synchronisierung ist fehlgeschlagen.');
      }
    } catch {
      toast.danger('Die Synchronisierung ist fehlgeschlagen.');
    } finally {
      setSyncingIds((prev) => { const next = new Set(prev); next.delete(appId); return next; });
    }
  };

  useEffect(() => {
    fetchApi('/apps')
      .then((res) => (res.ok ? res.json() : Promise.reject('Die Apps konnten nicht geladen werden.')))
      .then((data: AppConfig[]) => setApps(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const linkedApps = useMemo(() => apps.filter((a) => a.gitLabSync?.linked), [apps]);

  const stats = useMemo(() => ({
    total: linkedApps.length,
    success: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'success').length,
    pending: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'pending_approval').length,
    warning: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'warning').length,
    error: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'error').length,
    never: linkedApps.filter((a) => !a.gitLabSync?.lastSyncStatus || a.gitLabSync.lastSyncStatus === 'never').length,
  }), [linkedApps]);

  const filteredApps = useMemo(() => {
    let result = linkedApps;
    if (statusFilter !== 'all') {
      result = result.filter((a) => {
        const s = a.gitLabSync?.lastSyncStatus;
        if (statusFilter === 'never') return !s || s === 'never';
        return s === statusFilter;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.gitLabSync?.projectPath?.toLowerCase().includes(q) ||
        a.gitLabSync?.providerKey?.toLowerCase().includes(q));
    }
    return result;
  }, [linkedApps, statusFilter, search]);

  const figures = [
    { label: 'Verknüpft gesamt', value: stats.total, filter: 'all' },
    { label: 'Synchronisiert', value: stats.success, filter: 'success' },
    { label: 'Wartet auf Freigabe', value: stats.pending, filter: 'pending_approval' },
    { label: 'Fehler', value: stats.error, filter: 'error' },
  ];

  const filters = [
    { value: 'all', label: 'Alle', count: stats.total },
    { value: 'success', label: 'Synchronisiert', count: stats.success },
    { value: 'pending_approval', label: 'Wartet auf Freigabe', count: stats.pending },
    { value: 'warning', label: 'Mit Hinweisen', count: stats.warning },
    { value: 'error', label: 'Fehler', count: stats.error },
    { value: 'never', label: 'Noch nicht synchronisiert', count: stats.never },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Repository-Sync</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Der Synchronisierungsstand aller Apps, die mit einem GitLab- oder GitHub-Repository verknüpft sind.
        </p>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map((figure) => (
          <button
            key={figure.label}
            type="button"
            aria-pressed={statusFilter === figure.filter && figure.filter !== 'all'}
            onClick={() => setStatusFilter(statusFilter === figure.filter ? 'all' : figure.filter)}
            className="rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card size="sm" className={`transition-colors hover:bg-muted/40 ${statusFilter === figure.filter && figure.filter !== 'all' ? 'ring-2 ring-primary/40' : ''}`}>
              <Card.Content>
                <Stat className="flex-col items-start gap-1">
                  <Stat.Content>
                    <Stat.Label>{figure.label}</Stat.Label>
                    <Stat.Value size="md">{loading ? '–' : figure.value}</Stat.Value>
                  </Stat.Content>
                </Stat>
              </Card.Content>
            </Card>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(String(value))}>
          <Tabs.List aria-label="Status filtern">
            {filters.map((item) => (
              <Tabs.Trigger key={item.value} value={item.value}>{item.label} <Tabs.Badge>{item.count}</Tabs.Badge></Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <Input.Group size="sm" className="min-w-0 flex-1 basis-56 xl:ms-auto xl:max-w-xs">
          <Input.Addon><Search /></Input.Addon>
          <Input aria-label="Apps durchsuchen" placeholder="App oder Pfad suchen …" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Input.Group>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="Repository-Sync-Status" framed>
          <Table.Header>
            <Table.Row>
              <Table.Head>App</Table.Head>
              <Table.Head>Provider · Pfad</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Letzte Synchronisierung</Table.Head>
              <Table.Head className="hidden xl:table-cell">Fehlerdetails</Table.Head>
              <Table.Head align="end"><span className="sr-only">Aktionen</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <Table.Row key={index}>
                  {[0, 1, 2, 3, 4, 5].map((cell) => <Table.Cell key={cell} className={cell === 4 ? 'hidden xl:table-cell' : undefined}><span className="block h-4 w-24 animate-pulse rounded bg-muted" /></Table.Cell>)}
                </Table.Row>
              ))
            ) : filteredApps.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <GitBranch className="mx-auto mb-2 size-7 opacity-40" />
                  {linkedApps.length === 0 ? 'Keine Apps mit Repository-Verknüpfung gefunden.' : 'Keine Apps für diesen Filter gefunden.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              filteredApps.map((app) => {
                const sync = app.gitLabSync!;
                const meta = getSyncMeta(sync.lastSyncStatus);
                const iconSrc = getImageAssetUrl(app.icon);
                const syncing = syncingIds.has(app.id);
                return (
                  <Table.Row key={app.id}>
                    <Table.Cell>
                      <span className="flex items-center gap-3">
                        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
                          {iconSrc ? <Image src={iconSrc} alt="" fill className="object-contain p-1" sizes="36px" unoptimized /> : app.icon || '🏛️'}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{app.name}</span>
                          <span className="truncate font-mono text-xs text-muted-foreground">{app.id}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm">
                          {sync.providerKey || '—'}
                          {sync.providerType && <span className="ms-1 text-xs text-muted-foreground">({providerTypeLabel(sync.providerType)})</span>}
                        </span>
                        <span className="max-w-52 truncate font-mono text-xs text-muted-foreground" title={sync.projectPath}>{sync.projectPath || '—'}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap gap-1">
                        <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                        {sync.approvalRequired && <Badge variant="warning" size="sm">Manuelle Änderungen</Badge>}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm">{relativeTime(sync.lastSyncedAt)}</span>
                        {sync.lastSyncedAt && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(sync.lastSyncedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="hidden max-w-60 xl:table-cell">
                      {sync.lastSyncError
                        ? <span className="block truncate font-mono text-xs text-destructive" title={sync.lastSyncError}>{sync.lastSyncError}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </Table.Cell>
                    <Table.Cell align="end">
                      <span className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" loading={syncing} aria-label={`${app.name} jetzt synchronisieren`} onClick={() => void handleSyncNow(app.id)} />}>
                            <RefreshCw />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Jetzt synchronisieren</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${app.name} ansehen`} render={<NextLink href={`/apps/${app.id}`} />} />}>
                            <ExternalLink />
                          </Tooltip.Trigger>
                          <Tooltip.Content>App ansehen</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${app.name} bearbeiten`} render={<NextLink href={`/verwaltung/katalog/apps/${app.id}/edit`} />} />}>
                            <Pencil />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Bearbeiten</Tooltip.Content>
                        </Tooltip>
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Card>

      {!loading && filteredApps.length > 0 && (
        <p className="text-end text-xs text-muted-foreground">{filteredApps.length} von {linkedApps.length} verknüpften Apps</p>
      )}
    </div>
  );
}
