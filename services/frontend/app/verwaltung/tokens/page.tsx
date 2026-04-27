'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { fetchApi } from '@/lib/api';
import { Button, Chip, EmptyState, Table, toast } from '@heroui/react';
import { Info, KeyRound, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Token {
  id: string;
  key: string;
  description: string;
  type: string;
  disabled: boolean;
  disabled_reason?: string;
  created_at: string;
  expires_at?: string | null;
  user_id: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const res = await fetchApi('/admin/tokens');
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens ?? []);
        setError(null);
      } else {
        setError('Fehler beim Laden der Tokens.');
      }
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTokens();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetchApi(`/admin/tokens/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Token wurde widerrufen.');
        setDeleteId(null);
        await loadTokens();
      } else {
        toast.danger('Token konnte nicht widerrufen werden.');
      }
    } catch {
      toast.danger('Fehler beim Widerrufen.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">API-Tokens & Sitzungen</h2>
          <p className="text-xs text-muted mt-0.5">Alle aktiven Tokens der Plattform — abgelaufene und aktive</p>
        </div>
        <Button size="sm" variant="secondary" onPress={loadTokens} isDisabled={loading}>
          Aktualisieren
        </Button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Token-Liste" className="min-w-[750px]">
            <Table.Header>
              <Table.Column isRowHeader>Typ / Beschreibung</Table.Column>
              <Table.Column>Benutzer-ID</Table.Column>
              <Table.Column>Erstellt</Table.Column>
              <Table.Column>Läuft ab</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column className="text-right">Aktion</Table.Column>
            </Table.Header>
            <Table.Body
              items={loading ? [] : tokens}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-10 gap-2">
                  <Info className="w-8 h-8 text-muted opacity-50" />
                  <span className="text-muted">
                    {loading ? 'Wird geladen...' : 'Keine Tokens gefunden'}
                  </span>
                </EmptyState>
              )}
            >
              {(token) => (
                <Table.Row key={token.id} className={isExpired(token.expires_at) ? 'opacity-50' : ''}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-3.5 h-3.5 text-muted shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">
                          {token.type || 'session'}
                        </span>
                        {token.description && (
                          <span className="text-[10px] text-muted">{token.description}</span>
                        )}
                        <span className="text-[10px] font-mono text-muted/60">{token.key.slice(0, 12)}…</span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs font-mono text-muted">{token.user_id.slice(0, 8)}…</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-default-500">{formatDate(token.created_at)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={`text-xs ${isExpired(token.expires_at) ? 'text-danger' : 'text-default-500'}`}>
                      {formatDate(token.expires_at)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {token.disabled ? (
                      <Chip size="sm" variant="soft" color="danger" className="text-[9px] font-bold uppercase tracking-wider">
                        Deaktiviert
                      </Chip>
                    ) : isExpired(token.expires_at) ? (
                      <Chip size="sm" variant="soft" className="text-[9px] font-bold uppercase tracking-wider bg-default/20">
                        Abgelaufen
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="soft" color="success" className="text-[9px] font-bold uppercase tracking-wider">
                        Aktiv
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="tertiary"
                        onPress={() => setDeleteId(token.id)}
                        aria-label="Token widerrufen"
                      >
                        <Trash2 className="w-4 h-4 text-danger" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <ConfirmDialog
        isOpen={!!deleteId}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeleteId(null); }}
        title="Token widerrufen?"
        description="Das Token wird sofort ungültig. Der betroffene Benutzer wird beim nächsten API-Aufruf abgemeldet."
        confirmLabel="Widerrufen"
        isDanger
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
