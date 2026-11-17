'use client';

import {
  CreateTokenForm,
  TokenReveal,
  daysUntil,
  formatDate,
  useUserTokens,
  type UserToken,
} from '@/components/profile/tokens';
import { Alert } from '@/components/panelui/alert';
import { AlertDialog } from '@/components/panelui/alert-dialog';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Dialog } from '@/components/panelui/dialog';
import { Tooltip } from '@/components/panelui/tooltip';
import { useStoreName } from '@/context/SettingsContext';
import { toast } from '@/lib/toast';
import { ArrowRight, Bot, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';

const EXPIRING_SOON_DAYS = 14;

function TokenStatus({ token }: { token: UserToken }) {
  const days = daysUntil(token.expires_at);
  if (token.disabled) return <Badge variant="secondary" size="sm">Widerrufen</Badge>;
  if (days !== null && days <= 0) return <Badge variant="secondary" size="sm">Abgelaufen</Badge>;
  if (days !== null && days <= EXPIRING_SOON_DAYS) {
    return <Badge variant="warning" size="sm" dot>Läuft in {days} {days === 1 ? 'Tag' : 'Tagen'} ab</Badge>;
  }
  return <Badge variant="success" size="sm" dot>Aktiv</Badge>;
}

function expiryText(token: UserToken) {
  const days = daysUntil(token.expires_at);
  if (days === null) return 'läuft nicht ab';
  if (days <= 0) return `abgelaufen am ${formatDate(token.expires_at)}`;
  return `gültig bis ${formatDate(token.expires_at)}`;
}

function TokenRow({ token, onRevoke }: { token: UserToken; onRevoke: (token: UserToken) => void }) {
  const inactive = token.disabled || (daysUntil(token.expires_at) ?? 1) <= 0;
  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <span
        aria-hidden="true"
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${inactive ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}
      >
        <KeyRound className="size-4.5" />
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${inactive ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{token.description}</span>
          <TokenStatus token={token} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <code className="font-mono text-xs">{token.key_preview}</code>
          <span aria-hidden="true">·</span>
          <span>erstellt am {formatDate(token.created_at)}</span>
          <span aria-hidden="true">·</span>
          <span>{expiryText(token)}</span>
        </p>
      </div>
      {!token.disabled && (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`${token.description} widerrufen`} onClick={() => onRevoke(token)} />
            }
          >
            <Trash2 />
          </Tooltip.Trigger>
          <Tooltip.Content>Widerrufen</Tooltip.Content>
        </Tooltip>
      )}
    </li>
  );
}

function CreateTokenDialog({ create }: { create: (description: string, days: number) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Cleared only once closed, so the token does not vanish while the dialog fades out.
        if (!next) window.setTimeout(() => setToken(null), 300);
      }}
    >
      <Dialog.Trigger render={<Button />}>
        <Plus />
        Neues Token
      </Dialog.Trigger>
      <Dialog.Content>
        {token ? (
          <>
            <Dialog.Header title="Token erstellt" description="Trage es jetzt in deinen Agenten oder deine Integration ein." />
            <Dialog.Body>
              <TokenReveal token={token} />
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="secondary" render={<NextLink href="/profil/mcp" />}>
                <Bot />
                MCP einrichten
              </Button>
              <Dialog.Close render={<Button />}>Fertig</Dialog.Close>
            </Dialog.Footer>
          </>
        ) : (
          <>
            <Dialog.Header
              title="Neues Token"
              description="Das Token handelt in deinem Namen und hat dieselben Rechte wie dein Konto."
            />
            <Dialog.Body>
              <CreateTokenForm
                id="create-token"
                hideSubmit
                create={create}
                onCreated={(created) => {
                  setToken(created);
                  toast.success('Token erstellt.');
                }}
                onPendingChange={setPending}
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
              <Button type="submit" form="create-token" loading={pending}>
                Token erstellen
              </Button>
            </Dialog.Footer>
          </>
        )}
      </Dialog.Content>
    </Dialog>
  );
}

export default function ProfilTokensPage() {
  const storeName = useStoreName();
  const { tokens, loading, error, reload, create, revoke } = useUserTokens();
  const [revokeCandidate, setRevokeCandidate] = useState<UserToken | null>(null);

  const isActive = (token: UserToken) => !token.disabled && (daysUntil(token.expires_at) ?? 1) > 0;
  const active = tokens.filter(isActive);
  const inactive = tokens.filter((token) => !isActive(token));

  const confirmRevoke = async () => {
    if (!revokeCandidate) return;
    try {
      await revoke(revokeCandidate.id);
      toast.success('Token widerrufen.');
    } catch (revokeError) {
      toast.danger(revokeError instanceof Error ? revokeError.message : 'Token konnte nicht widerrufen werden.');
      throw revokeError;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">API-Tokens</h2>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Persönliche Schlüssel, mit denen Agenten und Skripte in deinem Namen auf {storeName} zugreifen.
          </p>
        </div>
        {/* With no tokens yet, the empty state below holds the only button. */}
        {(loading || tokens.length > 0) && <CreateTokenDialog create={create} />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
              <Alert.Actions>
                <Button size="sm" variant="secondary" onClick={() => void reload()}>Erneut versuchen</Button>
              </Alert.Actions>
            </Alert>
          )}

          {loading ? (
            <Card aria-busy="true">
              <ul className="divide-y">
                {[0, 1].map((index) => (
                  <li key={index} className="flex items-center gap-4 px-6 py-4">
                    <span className="size-10 animate-pulse rounded-xl bg-muted" />
                    <span className="flex flex-1 flex-col gap-2">
                      <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                      <span className="h-3 w-64 animate-pulse rounded bg-muted" />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : tokens.length === 0 && !error ? (
            <Card className="items-center gap-4 px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <KeyRound className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">Noch keine Tokens</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Erstelle ein Token, um einen Agenten über MCP oder ein eigenes Skript mit {storeName} zu verbinden.
                </p>
              </div>
              <CreateTokenDialog create={create} />
            </Card>
          ) : (
            <>
              {active.length > 0 && (
                <section aria-labelledby="active-tokens" className="flex flex-col gap-3">
                  <h3 id="active-tokens" className="text-sm font-medium text-muted-foreground">
                    Aktiv · {active.length}
                  </h3>
                  <Card className="gap-0 py-0">
                    <ul className="divide-y">
                      {active.map((token) => <TokenRow key={token.id} token={token} onRevoke={setRevokeCandidate} />)}
                    </ul>
                  </Card>
                </section>
              )}
              {inactive.length > 0 && (
                <section aria-labelledby="inactive-tokens" className="flex flex-col gap-3">
                  <h3 id="inactive-tokens" className="text-sm font-medium text-muted-foreground">
                    Abgelaufen oder widerrufen · {inactive.length}
                  </h3>
                  <Card className="gap-0 py-0">
                    <ul className="divide-y">
                      {inactive.map((token) => <TokenRow key={token.id} token={token} onRevoke={setRevokeCandidate} />)}
                    </ul>
                  </Card>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card size="sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                Sicher damit umgehen
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                <li>Ein Token pro Agent oder Gerät – dann kannst du gezielt eines widerrufen.</li>
                <li>Wähle die kürzeste Laufzeit, die passt, und erneuere rechtzeitig.</li>
                <li>Teile Tokens nie und lege sie nicht in Repositories ab.</li>
              </ul>
            </Card.Content>
          </Card>
          <Card size="sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                Agent verbinden
              </Card.Title>
              <Card.Description>Schritt für Schritt: Endpoint, Token und fertige Konfiguration.</Card.Description>
            </Card.Header>
            <Card.Footer>
              <Button variant="secondary" size="sm" render={<NextLink href="/profil/mcp" />}>
                MCP einrichten
                <ArrowRight />
              </Button>
            </Card.Footer>
          </Card>
        </aside>
      </div>

      <AlertDialog open={!!revokeCandidate} onOpenChange={(open) => { if (!open) setRevokeCandidate(null); }}>
        <AlertDialog.Content tone="destructive">
          <AlertDialog.Title>„{revokeCandidate?.description}“ widerrufen?</AlertDialog.Title>
          <AlertDialog.Description>
            Das Token wird sofort ungültig. Agenten, die es nutzen, können danach nicht mehr auf {storeName} zugreifen.
          </AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
            <AlertDialog.Action onClick={confirmRevoke}>Widerrufen</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}
