'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge, type BadgeVariant } from '@/components/panelui/badge';
import { Card } from '@/components/panelui/card';
import { Input } from '@/components/panelui/input';
import { Pagination } from '@/components/panelui/pagination';
import { Table } from '@/components/panelui/table';
import { Tabs } from '@/components/panelui/tabs';
import { UserAvatar, authorName } from '@/components/profile/UserAvatar';
import { fetchApi } from '@/lib/api';
import { auditOperationLabel } from '@/lib/auditOperations';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  user_id: string;
  operation: string;
  details: string;
  created_at: string;
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

const LIMIT = 50;

const AREAS = [
  { value: 'all', label: 'Alles' },
  { value: 'apps', label: 'Apps' },
  { value: 'users', label: 'Konten & Anmeldung' },
  { value: 'community', label: 'Bewertungen & FAQ' },
  { value: 'settings', label: 'Einstellungen' },
  { value: 'ai', label: 'KI' },
];

/** How an operation reads at a glance: removals red, new things green, the rest quiet. */
function variantOf(operation: string): BadgeVariant {
  if (/\.(delete|disable|remove)$/.test(operation) || operation.endsWith('.error')) return 'destructive';
  if (/\.(create|enable|publish|add)$/.test(operation)) return 'success';
  if (operation.startsWith('settings.') || operation.startsWith('role.')) return 'info';
  return 'secondary';
}

const timeFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [area, setArea] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // The search goes to the server, so it covers the whole log; typing waits a moment first.
  useEffect(() => {
    const id = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String((page - 1) * LIMIT) });
    if (area !== 'all') params.set('area', area);
    if (query) params.set('q', query);
    const id = window.setTimeout(() => {
      setLoading(true);
      fetchApi(`/admin/audit?${params}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Das Protokoll konnte nicht geladen werden.'))))
        .then((data: { entries?: AuditEntry[]; total?: number }) => {
          if (!active) return;
          setEntries(data.entries ?? []);
          setTotal(data.total ?? 0);
          setError(null);
        })
        .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.'); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(id); };
  }, [area, page, query]);

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Aktivitätsprotokoll</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Wer wann was auf der Plattform geändert hat.{!loading && ` ${total.toLocaleString('de-DE')} ${total === 1 ? 'Eintrag' : 'Einträge'}.`}
        </p>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={area} onValueChange={(value) => { setArea(String(value)); setPage(1); }}>
          <Tabs.List aria-label="Bereich">
            {AREAS.map((item) => <Tabs.Trigger key={item.value} value={item.value}>{item.label}</Tabs.Trigger>)}
          </Tabs.List>
        </Tabs>
        <Input.Group size="sm" className="min-w-0 flex-1 basis-56 xl:ms-auto xl:max-w-xs">
          <Input.Addon><Search /></Input.Addon>
          <Input aria-label="Protokoll durchsuchen" placeholder="Person oder Details" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Input.Group>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="Aktivitätsprotokoll" framed density="compact">
          <Table.Header>
            <Table.Row>
              <Table.Head>Zeitpunkt</Table.Head>
              <Table.Head>Person</Table.Head>
              <Table.Head>Aktion</Table.Head>
              <Table.Head>Details</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              Array.from({ length: 8 }, (_, index) => (
                <Table.Row key={index}>
                  {[0, 1, 2, 3].map((cell) => <Table.Cell key={cell} className="py-3"><span className="block h-4 w-28 animate-pulse rounded bg-muted" /></Table.Cell>)}
                </Table.Row>
              ))
            ) : entries.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4} className="py-12 text-center text-muted-foreground">Keine Einträge gefunden.</Table.Cell>
              </Table.Row>
            ) : (
              entries.map((entry) => {
                const person = { username: entry.username || '', displayName: entry.displayName, avatarUrl: entry.avatarUrl };
                const known = !!entry.username;
                return (
                  <Table.Row key={entry.id}>
                    <Table.Cell className="whitespace-nowrap py-2.5 font-mono text-xs text-muted-foreground">
                      <time dateTime={entry.created_at}>{timeFormat.format(new Date(entry.created_at))}</time>
                    </Table.Cell>
                    <Table.Cell className="py-2.5">
                      {known ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar user={person} size="xs" />
                          <span className="max-w-40 truncate" title={entry.email}>{authorName(person)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{entry.user_id === 'unknown' || !entry.user_id ? 'Unbekannt' : 'Gelöschtes Konto'}</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="py-2.5">
                      <Badge variant={variantOf(entry.operation)} size="sm" title={entry.operation}>{auditOperationLabel(entry.operation)}</Badge>
                    </Table.Cell>
                    <Table.Cell className="w-full max-w-0 py-2.5">
                      <span className="block truncate text-muted-foreground" title={entry.details}>{entry.details || '–'}</span>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Card>

      {!loading && total > LIMIT && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} von {total.toLocaleString('de-DE')}
          </p>
          <Pagination count={pageCount} page={page} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
