'use client';

import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { getImageAssetUrl } from '@/lib/assets';
import { Button, Chip, EmptyState, Input, Table, TextField } from '@heroui/react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitBranch,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type SyncStatusKey = 'success' | 'warning' | 'pending_approval' | 'error' | 'never';

const SYNC_META: Record<SyncStatusKey | string, {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'default';
  icon: React.ReactNode;
}> = {
  success:          { label: 'Synchronisiert',           color: 'success', icon: <CheckCircle2 className="w-3 h-3" /> },
  warning:          { label: 'Mit Hinweisen',             color: 'warning', icon: <AlertCircle  className="w-3 h-3" /> },
  pending_approval: { label: 'Wartet auf Freigabe',       color: 'warning', icon: <Clock        className="w-3 h-3" /> },
  error:            { label: 'Fehler',                    color: 'danger',  icon: <XCircle      className="w-3 h-3" /> },
  never:            { label: 'Noch nicht synchronisiert', color: 'default', icon: <RefreshCw    className="w-3 h-3" /> },
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

const STATUS_FILTERS = [
  { value: '', label: 'Alle' },
  { value: 'success', label: 'Synchronisiert' },
  { value: 'pending_approval', label: 'Wartet auf Freigabe' },
  { value: 'warning', label: 'Mit Hinweisen' },
  { value: 'error', label: 'Fehler' },
  { value: 'never', label: 'Noch nicht synchronisiert' },
];

const PROVIDER_TYPE_LABEL: Record<string, string> = {
  gitlab: 'GitLab',
  github: 'GitHub',
};

function providerTypeLabel(type?: string | null): string {
  if (!type) return '—';
  return PROVIDER_TYPE_LABEL[type] || type;
}

export default function RepositorySyncPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const handleSyncNow = async (appId: string) => {
    setSyncingIds((prev) => new Set(prev).add(appId));
    try {
      const res = await fetchApi(`/apps/${appId}/repository/sync`, { method: 'POST' });
      if (res.ok) {
        const refreshed = await fetchApi('/apps');
        if (refreshed.ok) setApps(await refreshed.json());
      }
    } finally {
      setSyncingIds((prev) => { const next = new Set(prev); next.delete(appId); return next; });
    }
  };

  useEffect(() => {
    fetchApi('/apps')
      .then((res) => (res.ok ? res.json() : Promise.reject('Fehler beim Laden')))
      .then((data: AppConfig[]) => setApps(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  const linkedApps = useMemo(
    () => apps.filter((a) => a.gitLabSync?.linked),
    [apps],
  );

  const stats = useMemo(() => ({
    total:   linkedApps.length,
    success: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'success').length,
    pending: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'pending_approval').length,
    warning: linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'warning').length,
    error:   linkedApps.filter((a) => a.gitLabSync?.lastSyncStatus === 'error').length,
    never:   linkedApps.filter(
      (a) => !a.gitLabSync?.lastSyncStatus || a.gitLabSync.lastSyncStatus === 'never',
    ).length,
  }), [linkedApps]);

  const filteredApps = useMemo(() => {
    let result = linkedApps;

    if (statusFilter) {
      result = result.filter((a) => {
        const s = a.gitLabSync?.lastSyncStatus;
        if (statusFilter === 'never') return !s || s === 'never';
        return s === statusFilter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.gitLabSync?.projectPath?.toLowerCase().includes(q) ||
          a.gitLabSync?.providerKey?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [linkedApps, statusFilter, search]);

  const statCards = [
    {
      label: 'Verknüpft gesamt',
      value: stats.total,
      icon: <Link2 className="w-4 h-4 text-muted" />,
      bg: 'bg-surface-secondary',
      text: 'text-foreground',
      filter: '',
    },
    {
      label: 'Synchronisiert',
      value: stats.success,
      icon: <CheckCircle2 className="w-4 h-4 text-success" />,
      bg: 'bg-success/10',
      text: 'text-success',
      filter: 'success',
    },
    {
      label: 'Wartet auf Freigabe',
      value: stats.pending,
      icon: <Clock className="w-4 h-4 text-warning" />,
      bg: 'bg-warning/10',
      text: 'text-warning',
      filter: 'pending_approval',
    },
    {
      label: 'Fehler',
      value: stats.error,
      icon: <XCircle className="w-4 h-4 text-danger" />,
      bg: 'bg-danger/10',
      text: 'text-danger',
      filter: 'error',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-surface-secondary rounded" />
                <div className="w-8 h-8 rounded-xl bg-surface-secondary" />
              </div>
              <div className="h-8 w-14 bg-surface-secondary rounded" />
            </div>
          ))}
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon, bg, text, filter }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter(statusFilter === filter ? '' : filter)}
            className={`rounded-2xl border bg-surface p-5 flex flex-col gap-3 shadow-sm text-left transition-all hover:shadow-md ${
              statusFilter === filter && filter !== ''
                ? 'border-accent ring-1 ring-accent/30'
                : 'border-border hover:border-accent/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                {icon}
              </div>
            </div>
            <span className={`text-3xl font-bold ${text}`}>{value}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? 'primary' : 'secondary'}
              onPress={() => setStatusFilter(f.value)}
              className={`rounded-full text-xs h-8 px-3 ${statusFilter === f.value ? 'text-background' : ''}`}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="relative shrink-0">
          <TextField value={search} onChange={setSearch}>
            <Input
              placeholder="App oder Pfad suchen…"
              className="bg-field-background h-9 rounded-xl pl-9 text-sm w-56"
            />
          </TextField>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Repository Sync Status" className="min-w-[860px]">
            <Table.Header>
              <Table.Column isRowHeader>App</Table.Column>
              <Table.Column>Provider · Pfad</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Letzte Synchronisierung</Table.Column>
              <Table.Column>Fehlerdetails</Table.Column>
              <Table.Column className="text-right">Aktionen</Table.Column>
            </Table.Header>
            <Table.Body
              items={filteredApps}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-12 gap-2">
                  <GitBranch className="w-8 h-8 text-muted opacity-40" />
                  <span className="text-muted">
                    {linkedApps.length === 0
                      ? 'Keine Apps mit Repository-Verknüpfung gefunden'
                      : 'Keine Apps für diesen Filter gefunden'}
                  </span>
                </EmptyState>
              )}
            >
              {(app) => {
                const sync = app.gitLabSync!;
                const meta = getSyncMeta(sync.lastSyncStatus);
                const iconSrc = getImageAssetUrl(app.icon);
                return (
                  <Table.Row key={app.id}>
                    {/* App */}
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-lg overflow-hidden shrink-0 shadow-sm">
                          {iconSrc ? (
                            <Image src={iconSrc} alt={app.name} fill className="object-contain p-1" sizes="36px" unoptimized />
                          ) : (
                            app.icon || '🏛️'
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{app.name}</span>
                          <span className="text-[10px] font-mono text-muted">{app.id}</span>
                        </div>
                      </div>
                    </Table.Cell>

                    {/* Provider · path */}
                    <Table.Cell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {sync.providerKey || '—'}
                          {sync.providerType && (
                            <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                              ({providerTypeLabel(sync.providerType)})
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-muted truncate max-w-[200px]">
                          {sync.projectPath || '—'}
                        </span>
                      </div>
                    </Table.Cell>

                    {/* Sync status */}
                    <Table.Cell>
                      <div className="flex flex-col gap-1.5">
                        <Chip
                          size="sm"
                          color={meta.color}
                          variant="soft"
                          className="text-[10px] font-bold uppercase tracking-wider gap-1 pl-1.5"
                        >
                          {meta.icon}
                          {meta.label}
                        </Chip>
                        {sync.approvalRequired && (
                          <Chip size="sm" color="warning" variant="soft" className="text-[9px] font-bold uppercase tracking-wider">
                            Manuelle Änderungen
                          </Chip>
                        )}
                      </div>
                    </Table.Cell>

                    {/* Last synced */}
                    <Table.Cell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-foreground font-medium">
                          {relativeTime(sync.lastSyncedAt)}
                        </span>
                        {sync.lastSyncedAt && (
                          <span className="text-[10px] text-muted font-mono">
                            {new Date(sync.lastSyncedAt).toLocaleString('de-DE', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </Table.Cell>

                    {/* Error */}
                    <Table.Cell>
                      {sync.lastSyncError ? (
                        <span className="text-xs text-danger font-mono truncate max-w-[220px] block" title={sync.lastSyncError}>
                          {sync.lastSyncError}
                        </span>
                      ) : (
                        <span className="text-xs text-muted italic">—</span>
                      )}
                    </Table.Cell>

                    {/* Actions */}
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="tertiary"
                          onPress={() => handleSyncNow(app.id)}
                          isDisabled={syncingIds.has(app.id)}
                          aria-label="Jetzt synchronisieren"
                        >
                          {syncingIds.has(app.id)
                            ? <Loader2 className="w-4 h-4 animate-spin text-muted" />
                            : <RefreshCw className="w-4 h-4 text-muted" />}
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="tertiary"
                          onPress={() => router.push(`/apps/${app.id}`)}
                          aria-label="App ansehen"
                        >
                          <ExternalLink className="w-4 h-4 text-muted" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="tertiary"
                          onPress={() => router.push(`/verwaltung/apps/${app.id}/edit`)}
                          aria-label="App bearbeiten"
                        >
                          <Pencil className="w-4 h-4 text-muted" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {filteredApps.length > 0 && (
        <p className="text-xs text-muted text-right">
          {filteredApps.length} von {linkedApps.length} verknüpften Apps
        </p>
      )}
    </div>
  );
}
