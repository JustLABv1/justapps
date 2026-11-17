'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Input } from '@/components/panelui/input';
import { Table } from '@/components/panelui/table';
import { Tabs } from '@/components/panelui/tabs';
import { Tooltip } from '@/components/panelui/tooltip';
import { UserAvatar, authorName } from '@/components/profile/UserAvatar';
import { fetchApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Token {
  id: string;
  description: string;
  type: string;
  disabled: boolean;
  disabled_reason?: string;
  created_at: string;
  expires_at?: string | null;
  user_id: string;
  key_preview: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

type Filter = 'active' | 'inactive' | 'all';

const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
function timeTo(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'jetzt';
}
const fullDate = (value: string) => new Date(value).toLocaleString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isExpired = (token: Token) => !!token.expires_at && new Date(token.expires_at) < new Date();
const isActive = (token: Token) => !token.disabled && !isExpired(token);

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [revokeCandidate, setRevokeCandidate] = useState<Token | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      const response = await fetchApi('/admin/tokens');
      if (!response.ok) throw new Error('Die Tokens konnten nicht geladen werden.');
      const data = await response.json() as { tokens?: Token[] };
      setTokens(data.tokens ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadTokens(), 0);
    return () => window.clearTimeout(id);
  }, [loadTokens]);

  const counts = useMemo(() => ({
    active: tokens.filter(isActive).length,
    inactive: tokens.filter((token) => !isActive(token)).length,
    all: tokens.length,
  }), [tokens]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de');
    return tokens
      .filter((token) => filter === 'all' || (filter === 'active' ? isActive(token) : !isActive(token)))
      .filter((token) => !query || [token.description, token.username, token.email, token.displayName ?? '', token.key_preview]
        .some((value) => value.toLocaleLowerCase('de').includes(query)));
  }, [filter, search, tokens]);

  const revoke = async () => {
    if (!revokeCandidate) return;
    setIsRevoking(true);
    try {
      const response = await fetchApi(`/admin/tokens/${revokeCandidate.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Das Token konnte nicht widerrufen werden.');
      toast.success('Token widerrufen.');
      setRevokeCandidate(null);
      await loadTokens();
    } catch (revokeError) {
      toast.danger(revokeError instanceof Error ? revokeError.message : 'Das Token konnte nicht widerrufen werden.');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">API-Tokens</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Alle persönlichen Tokens der Plattform. Ein Token handelt im Namen seines Kontos; widerrufen Sie es, wenn es nicht mehr gebraucht wird oder in falsche Hände geraten sein könnte.
        </p>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
          <Alert.Actions>
            <Button size="sm" variant="secondary" onClick={() => void loadTokens()}>Erneut versuchen</Button>
          </Alert.Actions>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <Tabs.List aria-label="Tokens filtern">
            <Tabs.Trigger value="active">Aktiv <Tabs.Badge>{counts.active}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="inactive">Abgelaufen oder widerrufen <Tabs.Badge>{counts.inactive}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="all">Alle</Tabs.Trigger>
          </Tabs.List>
        </Tabs>
        <Input.Group size="sm" className="min-w-0 flex-1 basis-56 sm:ms-auto sm:max-w-xs">
          <Input.Addon><Search /></Input.Addon>
          <Input aria-label="Tokens durchsuchen" placeholder="Konto oder Bezeichnung" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Input.Group>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="API-Tokens" framed>
          <Table.Header>
            <Table.Row>
              <Table.Head>Konto</Table.Head>
              <Table.Head>Token</Table.Head>
              <Table.Head>Läuft ab</Table.Head>
              <Table.Head className="hidden xl:table-cell">Erstellt</Table.Head>
              <Table.Head align="end"><span className="sr-only">Aktionen</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              Array.from({ length: 4 }, (_, index) => (
                <Table.Row key={index}>
                  {[0, 1, 2, 3, 4].map((cell) => <Table.Cell key={cell}><span className="block h-4 w-24 animate-pulse rounded bg-muted" /></Table.Cell>)}
                </Table.Row>
              ))
            ) : visible.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5} className="py-12 text-center text-muted-foreground">
                  {tokens.length === 0 ? 'Noch keine Tokens angelegt.' : 'Keine Tokens in dieser Ansicht.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              visible.map((token) => {
                const expired = isExpired(token);
                const account = { username: token.username || 'Unbekanntes Konto', displayName: token.displayName, avatarUrl: token.avatarUrl };
                return (
                  <Table.Row key={token.id} className={isActive(token) ? undefined : 'text-muted-foreground'}>
                    <Table.Cell>
                      <span className="flex items-center gap-3">
                        <UserAvatar user={account} size="sm" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{authorName(account)}</span>
                          <span className="truncate text-xs text-muted-foreground">{token.email || token.user_id}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate">{token.description || 'Ohne Bezeichnung'}</span>
                          {token.disabled ? (
                            <Tooltip>
                              <Tooltip.Trigger render={<Badge variant="destructive" size="sm" />}>Widerrufen</Tooltip.Trigger>
                              <Tooltip.Content>{token.disabled_reason || 'Widerrufen'}</Tooltip.Content>
                            </Tooltip>
                          ) : expired ? (
                            <Badge variant="secondary" size="sm">Abgelaufen</Badge>
                          ) : null}
                        </span>
                        <code className="font-mono text-xs text-muted-foreground">{token.key_preview}</code>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">
                      {token.expires_at
                        ? <time dateTime={token.expires_at} title={fullDate(token.expires_at)}>{timeTo(token.expires_at)}</time>
                        : 'nie'}
                    </Table.Cell>
                    <Table.Cell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                      {new Date(token.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Table.Cell>
                    <Table.Cell align="end">
                      {!token.disabled && (
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`Token von ${authorName(account)} widerrufen`} onClick={() => setRevokeCandidate(token)} />}>
                            <Trash2 />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Widerrufen</Tooltip.Content>
                        </Tooltip>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Card>

      <ConfirmDialog
        isOpen={!!revokeCandidate}
        onOpenChange={(open) => { if (!open && !isRevoking) setRevokeCandidate(null); }}
        title="Token widerrufen?"
        description={revokeCandidate
          ? `„${revokeCandidate.description || 'Ohne Bezeichnung'}“ von ${revokeCandidate.username || 'diesem Konto'} wird sofort ungültig. Anwendungen, die es nutzen, verlieren den Zugriff.`
          : ''}
        confirmLabel="Widerrufen"
        isDanger
        isLoading={isRevoking}
        onConfirm={revoke}
      />
    </div>
  );
}
