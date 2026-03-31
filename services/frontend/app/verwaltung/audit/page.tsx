'use client';

import { fetchApi } from '@/lib/api';
import { Chip, EmptyState, Input, Pagination, Table, TextField } from '@heroui/react';
import {
  Info,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface AuditEntry {
  id: string;
  user_id: string;
  operation: string;
  details: string;
  created_at: string;
  username?: string;
  email?: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  limit: number;
  offset: number;
}

type OperationColor = 'success' | 'warning' | 'danger' | 'default' | 'accent';

const OPERATION_META: Record<string, { label: string; color: OperationColor; icon: React.ReactNode }> = {
  'app.create':      { label: 'App erstellt',            color: 'success', icon: <Plus      className="w-3 h-3" /> },
  'app.update':      { label: 'App aktualisiert',        color: 'warning', icon: <Pencil    className="w-3 h-3" /> },
  'app.delete':      { label: 'App gelöscht',            color: 'danger',  icon: <Trash2    className="w-3 h-3" /> },
  'user.create':     { label: 'Benutzer erstellt',       color: 'success', icon: <UserPlus  className="w-3 h-3" /> },
  'user.update':     { label: 'Benutzer aktualisiert',   color: 'warning', icon: <UserCog   className="w-3 h-3" /> },
  'user.delete':     { label: 'Benutzer gelöscht',       color: 'danger',  icon: <UserMinus className="w-3 h-3" /> },
  'user.enable':     { label: 'Benutzer aktiviert',      color: 'success', icon: <UserCheck className="w-3 h-3" /> },
  'user.disable':    { label: 'Benutzer deaktiviert',    color: 'danger',  icon: <UserX     className="w-3 h-3" /> },
  'settings.update': { label: 'Einstellungen geändert',  color: 'accent',  icon: <Settings  className="w-3 h-3" /> },
};

function getOperationMeta(operation: string) {
  return OPERATION_META[operation] ?? { label: operation, color: 'default' as OperationColor, icon: null };
}

const FILTER_OPTIONS = [
  { value: '', label: 'Alle Operationen' },
  ...Object.entries(OPERATION_META).map(([value, { label }]) => ({ value, label })),
];

const LIMIT = 50;

// Skeleton row IDs used when loading
const SKELETON_IDS = Array.from({ length: 10 }, (_, i) => `__skeleton__${i}`);

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [operationFilter, setOperationFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const offset = (page - 1) * LIMIT;
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (operationFilter) params.set('operation', operationFilter);
      try {
        const res = await fetchApi(`/admin/audit?${params}`);
        if (!res.ok) throw new Error('Fehler beim Laden');
        const data: AuditResponse = await res.json();
        setEntries(data.entries ?? []);
        setHasMore((data.entries ?? []).length === LIMIT);
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, operationFilter]);

  const filteredEntries = useMemo(() => {
    if (!userSearch.trim()) return entries;
    const q = userSearch.toLowerCase();
    return entries.filter(
      (e) =>
        e.username?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.user_id?.toLowerCase().includes(q),
    );
  }, [entries, userSearch]);

  const displayItems: AuditEntry[] = loading
    ? SKELETON_IDS.map((id) => ({ id, user_id: '', operation: '', details: '', created_at: '' }))
    : filteredEntries;

  const totalPagesEstimate = hasMore ? page + 1 : page;

  const handleFilterChange = (value: string) => {
    setOperationFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Audit-Protokoll</h2>
          <p className="text-xs text-muted mt-0.5">
            Alle administrativen Aktionen der Plattform
            {!loading && (
              <span className="ml-2 text-foreground font-semibold">
                · {filteredEntries.length} Einträge
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* User search */}
          <div className="relative">
            <TextField value={userSearch} onChange={setUserSearch}>
              <Input
                placeholder="Benutzer suchen…"
                className="bg-field-background h-9 rounded-xl pl-9 text-sm w-48"
              />
            </TextField>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          </div>

          {/* Operation filter */}
          <select
            value={operationFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="text-sm bg-surface border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-accent transition-colors h-9"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Audit-Protokoll" className="min-w-[700px]">
            <Table.Header>
              <Table.Column isRowHeader>Zeitpunkt</Table.Column>
              <Table.Column>Benutzer</Table.Column>
              <Table.Column>Operation</Table.Column>
              <Table.Column>Details</Table.Column>
            </Table.Header>
            <Table.Body
              items={displayItems}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-10 gap-2">
                  <Info className="w-8 h-8 text-muted opacity-50" />
                  <span className="text-muted">Keine Einträge gefunden</span>
                </EmptyState>
              )}
            >
              {(entry) => {
                const isSkeleton = entry.id.startsWith('__skeleton__');
                const meta = isSkeleton ? null : getOperationMeta(entry.operation);
                return (
                  <Table.Row key={entry.id}>
                    <Table.Cell>
                      {isSkeleton ? (
                        <div className="h-4 w-28 bg-surface-secondary rounded animate-pulse" />
                      ) : (
                        <span className="text-xs text-default-500 font-mono">
                          {new Date(entry.created_at).toLocaleString('de-DE', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                    </Table.Cell>

                    <Table.Cell>
                      {isSkeleton ? (
                        <div className="space-y-1.5">
                          <div className="h-3 w-20 bg-surface-secondary rounded animate-pulse" />
                          <div className="h-2 w-28 bg-surface-secondary rounded animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground">
                            {entry.username || '—'}
                          </span>
                          {entry.email && (
                            <span className="text-[10px] text-muted">{entry.email}</span>
                          )}
                        </div>
                      )}
                    </Table.Cell>

                    <Table.Cell>
                      {isSkeleton ? (
                        <div className="h-5 w-32 bg-surface-secondary rounded-full animate-pulse" />
                      ) : (
                        <Chip
                          size="sm"
                          color={meta!.color as 'success' | 'warning' | 'danger' | 'default' | 'accent'}
                          variant="soft"
                          className="text-[10px] font-bold uppercase tracking-wider gap-1 pl-1.5"
                        >
                          {meta!.icon}
                          {meta!.label}
                        </Chip>
                      )}
                    </Table.Cell>

                    <Table.Cell>
                      {isSkeleton ? (
                        <div className="h-3 w-48 bg-surface-secondary rounded animate-pulse" />
                      ) : (
                        <span className="text-xs text-muted max-w-xs truncate block">
                          {entry.details || '—'}
                        </span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {(page > 1 || hasMore) && (
        <div className="py-2 px-2 flex justify-between items-center mt-4">
          <Pagination size="sm">
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Pagination.PreviousIcon />
                  Zurück
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: totalPagesEstimate }, (_, i) => i + 1).map((p) => (
                <Pagination.Item key={p}>
                  <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                    {p}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next
                  isDisabled={!hasMore}
                  onPress={() => setPage((p) => p + 1)}
                >
                  Weiter
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </div>
      )}
    </div>
  );
}
