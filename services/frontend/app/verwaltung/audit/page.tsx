'use client';

import { fetchApi } from '@/lib/api';
import { EmptyState, Pagination, Table } from '@heroui/react';
import { Info } from 'lucide-react';
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

const OPERATION_LABELS: Record<string, string> = {
  'app.create': 'App erstellt',
  'app.update': 'App aktualisiert',
  'app.delete': 'App gelöscht',
  'user.create': 'Benutzer erstellt',
  'user.update': 'Benutzer aktualisiert',
  'user.delete': 'Benutzer gelöscht',
  'user.enable': 'Benutzer aktiviert',
  'user.disable': 'Benutzer deaktiviert',
  'settings.update': 'Einstellungen geändert',
};

const FILTER_OPTIONS = [
  { value: '', label: 'Alle' },
  { value: 'app.create', label: 'App erstellt' },
  { value: 'app.update', label: 'App aktualisiert' },
  { value: 'app.delete', label: 'App gelöscht' },
  { value: 'user.create', label: 'Benutzer erstellt' },
  { value: 'user.update', label: 'Benutzer aktualisiert' },
  { value: 'user.delete', label: 'Benutzer gelöscht' },
  { value: 'user.enable', label: 'Benutzer aktiviert' },
  { value: 'user.disable', label: 'Benutzer deaktiviert' },
  { value: 'settings.update', label: 'Einstellungen geändert' },
];

const LIMIT = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [operationFilter, setOperationFilter] = useState('');
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

  const totalPagesEstimate = useMemo(
    () => (hasMore ? page + 1 : page),
    [hasMore, page]
  );

  const handleFilterChange = (value: string) => {
    setOperationFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Audit-Protokoll</h2>
          <p className="text-xs text-muted mt-0.5">Alle administrativen Aktionen der Plattform</p>
        </div>

        <select
          value={operationFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="text-sm bg-surface border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-accent transition-colors"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
              items={loading ? [] : entries}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-10 gap-2">
                  <Info className="w-8 h-8 text-muted opacity-50" />
                  <span className="text-muted">
                    {loading ? 'Wird geladen...' : 'Keine Einträge gefunden'}
                  </span>
                </EmptyState>
              )}
            >
              {(entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell>
                    <span className="text-xs text-default-500 font-mono">
                      {new Date(entry.created_at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        {entry.username || '—'}
                      </span>
                      {entry.email && (
                        <span className="text-[10px] text-muted">{entry.email}</span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs font-mono text-accent">
                      {OPERATION_LABELS[entry.operation] ?? entry.operation}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-muted max-w-xs truncate block">
                      {entry.details || '—'}
                    </span>
                  </Table.Cell>
                </Table.Row>
              )}
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
