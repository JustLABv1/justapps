'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchApi } from '@/lib/api';
import { useStoreName } from '@/context/SettingsContext';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Table,
  TextField,
  toast,
} from '@heroui/react';
import { Check, Clipboard, Info, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface UserToken {
  id: string;
  description: string;
  type: string;
  disabled: boolean;
  created_at: string;
  expires_at?: string | null;
  key_preview: string;
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isExpired(expiresAt?: string | null) {
  return !!expiresAt && new Date(expiresAt) < new Date();
}

export default function ProfilTokensPage() {
  const storeName = useStoreName();
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('Mein MCP-Agent');
  const [expiresInDays, setExpiresInDays] = useState('365');
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi('/user/tokens', { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Tokens konnten nicht geladen werden.');
      }
      const data = await response.json() as { tokens?: UserToken[] };
      setTokens(data.tokens || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTokens();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTokens]);

  const copyToken = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      toast.success('Token in die Zwischenablage kopiert.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.danger('Token konnte nicht kopiert werden.');
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetchApi('/user/tokens', {
        method: 'POST',
        body: JSON.stringify({
          description: description.trim(),
          expires_in_days: Number(expiresInDays),
        }),
      });
      const body = await response.json().catch(() => ({})) as { token?: string; message?: string };
      if (!response.ok || !body.token) {
        throw new Error(body.message || 'Token konnte nicht erstellt werden.');
      }
      setCreatedToken(body.token);
      setCopied(false);
      toast.success('Neues MCP-Token erstellt.');
      await loadTokens();
    } catch (createError) {
      toast.danger(createError instanceof Error ? createError.message : 'Token konnte nicht erstellt werden.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevoking(true);
    try {
      const response = await fetchApi(`/user/tokens/${revokeId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Token konnte nicht widerrufen werden.');
      }
      toast.success('Token wurde widerrufen.');
      setRevokeId(null);
      await loadTokens();
    } catch (revokeError) {
      toast.danger(revokeError instanceof Error ? revokeError.message : 'Token konnte nicht widerrufen werden.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">API-Tokens für Agenten</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Erstelle persönliche Tokens für deinen MCP-Agenten oder andere Integrationen. Ein vollständiger Token wird nur direkt nach der Erstellung angezeigt.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onPress={() => void loadTokens()} isDisabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      {createdToken && (
        <Card variant="secondary" className="border border-accent/30 bg-accent/5">
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-success" />
              Token einmalig sichern
            </Card.Title>
            <Card.Description>
              Kopiere den Wert jetzt in die MCP-Konfiguration. Aus Sicherheitsgründen wird er später nicht erneut ausgegeben.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-3 text-xs text-foreground">
                {createdToken}
              </code>
              <Button className="shrink-0" variant="secondary" onPress={() => void copyToken()}>
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-accent" />
            Neues MCP-Token
          </Card.Title>
          <Card.Description>
            Wähle eine klare Bezeichnung und eine Laufzeit. Für langfristige Agenten ist eine regelmäßige Erneuerung sinnvoll.
          </Card.Description>
        </Card.Header>
        <Form onSubmit={handleCreate}>
          <Card.Content className="grid gap-5 sm:grid-cols-[1fr_220px]">
            <TextField isRequired value={description} onChange={setDescription}>
              <Label>Bezeichnung</Label>
              <Input placeholder="z. B. Mein MCP-Agent" maxLength={120} />
            </TextField>
            <Select value={expiresInDays} onChange={(value) => setExpiresInDays(String(value))}>
              <Label>Laufzeit</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="30" textValue="30 Tage">30 Tage<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="90" textValue="90 Tage">90 Tage<ListBox.ItemIndicator /></ListBox.Item>
                  <ListBox.Item id="365" textValue="1 Jahr">1 Jahr<ListBox.ItemIndicator /></ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </Card.Content>
          <Card.Footer className="flex flex-col items-start gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tokens geben Zugriff im Namen deines Kontos. Teile sie nicht und widerrufe sie bei Verdacht sofort.
            </p>
            <Button type="submit" isPending={creating} isDisabled={!description.trim() || creating}>
              <KeyRound className="h-4 w-4" />
              Token erstellen
            </Button>
          </Card.Footer>
        </Form>
      </Card>

      <Card>
        <Card.Header className="flex-row items-center justify-between gap-3">
          <div>
            <Card.Title className="text-base">Meine MCP-Tokens</Card.Title>
            <Card.Description>{tokens.length} Token{tokens.length === 1 ? '' : 's'} angelegt</Card.Description>
          </div>
          <KeyRound className="h-5 w-5 text-muted" />
        </Card.Header>
        {error && (
          <Card.Content>
            <div className="flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              <Info className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button size="sm" variant="secondary" onPress={() => void loadTokens()}>Wiederholen</Button>
            </div>
          </Card.Content>
        )}
        <Card.Content className="p-0 sm:px-6 sm:pb-6">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Meine MCP-Tokens" className="min-w-[720px]">
                <Table.Header>
                  <Table.Column isRowHeader>Token</Table.Column>
                  <Table.Column>Erstellt</Table.Column>
                  <Table.Column>Läuft ab</Table.Column>
                  <Table.Column>Status</Table.Column>
                  <Table.Column className="text-right">Aktion</Table.Column>
                </Table.Header>
                <Table.Body
                  items={loading ? [] : tokens}
                  renderEmptyState={() => (
                    <EmptyState className="flex flex-col items-center justify-center gap-2 py-12">
                      {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted" /> : <KeyRound className="h-8 w-8 text-muted opacity-50" />}
                      <span className="text-muted">{loading ? 'Wird geladen…' : 'Noch keine MCP-Tokens vorhanden.'}</span>
                    </EmptyState>
                  )}
                >
                  {(token) => {
                    const expired = isExpired(token.expires_at);
                    return (
                      <Table.Row key={token.id} className={expired || token.disabled ? 'opacity-60' : undefined}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <KeyRound className="h-4 w-4 shrink-0 text-muted" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-foreground">{token.description}</div>
                              <code className="text-[11px] text-muted">{token.key_preview}</code>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell><span className="text-xs text-muted">{formatDate(token.created_at)}</span></Table.Cell>
                        <Table.Cell><span className={`text-xs ${expired ? 'text-danger' : 'text-muted'}`}>{formatDate(token.expires_at)}</span></Table.Cell>
                        <Table.Cell>
                          {token.disabled ? (
                            <Chip size="sm" variant="soft" color="danger" className="text-[9px] font-bold uppercase tracking-wider">Widerrufen</Chip>
                          ) : expired ? (
                            <Chip size="sm" variant="soft" className="bg-default/20 text-[9px] font-bold uppercase tracking-wider">Abgelaufen</Chip>
                          ) : (
                            <Chip size="sm" variant="soft" color="success" className="text-[9px] font-bold uppercase tracking-wider">Aktiv</Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex justify-end">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="tertiary"
                              isDisabled={token.disabled}
                              onPress={() => setRevokeId(token.id)}
                              aria-label={`Token ${token.description} widerrufen`}
                            >
                              <Trash2 className="h-4 w-4 text-danger" />
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
        </Card.Content>
      </Card>

      <ConfirmDialog
        isOpen={!!revokeId}
        onOpenChange={(open) => { if (!open && !revoking) setRevokeId(null); }}
        title="MCP-Token widerrufen?"
        description={`Der Token wird sofort ungültig. Ein damit verbundener Agent kann danach nicht mehr auf ${storeName} zugreifen.`}
        confirmLabel="Widerrufen"
        isDanger
        isLoading={revoking}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
