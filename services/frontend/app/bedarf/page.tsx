'use client';

import { AppStoreGate } from '@/components/AppStoreGate';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Alert } from '@/components/panelui/alert';
import { Avatar } from '@/components/panelui/avatar';
import { Badge, type BadgeVariant } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Combobox } from '@/components/panelui/combobox';
import { Card } from '@/components/panelui/card';
import { Dialog } from '@/components/panelui/dialog';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Menu } from '@/components/panelui/menu';
import { Select } from '@/components/panelui/select';
import { Tabs } from '@/components/panelui/tabs';
import { Tooltip } from '@/components/panelui/tooltip';
import { Textarea } from '@/components/panelui/textarea';
import { UserAvatar, displayNameOf } from '@/components/profile/UserAvatar';
import type { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { loadApps } from '@/lib/appGroups';
import { getImageAssetUrl, resolveAssetUrl } from '@/lib/assets';
import { toast } from '@/lib/toast';
import { ArrowUp, CheckCircle2, CircleDashed, Lightbulb, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { Suspense, useEffect, useId, useMemo, useState } from 'react';

type Status = 'open' | 'planned' | 'fulfilled' | 'closed';

interface Request {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  title: string;
  description: string;
  status: Status;
  linkedAppId: string | null;
  linkedAppName: string | null;
  linkedAppIcon: string | null;
  response: string;
  voters: { id: string; username: string; displayName: string; avatarUrl: string }[];
  votes: number;
  voted: boolean;
  mine: boolean;
  canModerate: boolean;
  canRespond: boolean;
  createdAt: string;
  updatedAt: string;
}

const STATUS: Record<Status, { label: string; variant: BadgeVariant; hint: string }> = {
  open: { label: 'Offen', variant: 'secondary', hint: 'Wird noch gesucht' },
  planned: { label: 'Geplant', variant: 'info', hint: 'Wird umgesetzt' },
  fulfilled: { label: 'Erfüllt', variant: 'success', hint: 'Es gibt eine passende App' },
  closed: { label: 'Geschlossen', variant: 'outline', hint: 'Nicht weiterverfolgt' },
};

const STATUS_ITEMS = (Object.keys(STATUS) as Status[]).map((value) => ({ value, label: STATUS[value].label }));

const TABS = [
  { value: 'active', label: 'Offen & geplant' },
  { value: 'fulfilled', label: 'Erfüllt' },
  { value: 'all', label: 'Alle' },
];

const SORTS = [
  { value: 'votes', label: 'Meiste Stimmen' },
  { value: 'new', label: 'Neueste' },
];

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(path, init);
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || 'Die Anfrage ist fehlgeschlagen.');
  return data as T;
}

function AppChip({ name, icon, id }: { name: string; icon: string | null; id: string }) {
  const src = getImageAssetUrl(icon ?? undefined);
  return (
    <NextLink
      href={`/apps/${encodeURIComponent(id)}`}
      className="inline-flex items-center gap-2 rounded-full bg-muted/60 py-1 ps-1.5 pe-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="relative flex size-5 items-center justify-center overflow-hidden rounded-full text-sm leading-none">
        {src ? <Image src={src} alt="" fill sizes="20px" className="object-contain" unoptimized /> : icon || '🏛️'}
      </span>
      {name}
    </NextLink>
  );
}

function VoteButton({ item, disabled, onVote }: { item: Request; disabled: boolean; onVote: () => void }) {
  const done = item.status === 'fulfilled' || item.status === 'closed';
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={disabled || (done && !item.voted)}
      aria-pressed={item.voted}
      aria-label={item.voted ? `Stimme zurückziehen (${item.votes})` : `Das brauche ich auch (${item.votes})`}
      className={`flex w-14 shrink-0 flex-col items-center gap-0.5 self-start rounded-xl py-2 outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${item.voted ? 'bg-primary/10 text-primary ring-primary/30' : 'bg-card ring-foreground/10 hover:bg-muted/50 disabled:hover:bg-card'}`}
    >
      <ArrowUp className="size-4" />
      <span className="text-base font-semibold tabular-nums leading-none">{item.votes}</span>
    </button>
  );
}

function RequestDialog({
  open,
  onOpenChange,
  editing,
  existing,
  apps,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Request | null;
  existing: Request[];
  apps: AppConfig[];
  onSaved: (item: Request) => void;
}) {
  const formId = useId();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const words = title.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const matches = <T,>(items: T[], text: (item: T) => string) =>
    words.length === 0 ? [] : items.filter((item) => words.some((word) => text(item).toLowerCase().includes(word))).slice(0, 3);
  const similarApps = editing ? [] : matches(apps, (app) => `${app.name} ${(app.tags ?? []).join(' ')} ${(app.categories ?? []).join(' ')}`);
  const similarRequests = editing ? [] : matches(existing.filter((item) => item.status === 'open' || item.status === 'planned'), (item) => item.title);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = editing
        ? await request<Request>(`/requests/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ title, description }) })
        : await request<Request>('/requests', { method: 'POST', body: JSON.stringify({ title, description }) });
      onSaved(saved);
      onOpenChange(false);
      toast.success(editing ? 'Bedarfsmeldung gespeichert.' : 'Bedarfsmeldung veröffentlicht.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <Dialog.Content size="lg">
        <form id={formId} onSubmit={save} className="flex min-h-0 flex-col">
          <Dialog.Header
            title={editing ? 'Bedarfsmeldung bearbeiten' : 'Was suchen Sie?'}
            description={editing ? undefined : 'Beschreiben Sie, wofür Sie eine App brauchen. Andere können zustimmen, und wer eine passende App kennt oder anbietet, sieht es hier.'}
          />
          <Dialog.Body className="flex flex-col gap-4">
            <Field>
              <Field.Label required>Titel</Field.Label>
              <Input required maxLength={140} autoFocus value={title} placeholder="z. B. Tool zum gemeinsamen Bearbeiten von Karten" onChange={(event) => setTitle(event.target.value)} />
            </Field>

            {(similarApps.length > 0 || similarRequests.length > 0) && (
              <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 text-sm">
                {similarApps.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-medium">Gibt es vielleicht schon im Katalog:</span>
                    <div className="flex flex-wrap gap-2">
                      {similarApps.map((app) => <AppChip key={app.id} id={app.id} name={app.name} icon={app.icon ?? null} />)}
                    </div>
                  </div>
                )}
                {similarRequests.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Ähnliche Bedarfsmeldungen – lieber zustimmen als doppelt melden:</span>
                    <ul className="list-disc ps-5 text-muted-foreground">
                      {similarRequests.map((item) => <li key={item.id}>{item.title} ({item.votes} {item.votes === 1 ? 'Stimme' : 'Stimmen'})</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Field>
              <Field.Label>Beschreibung</Field.Label>
              <Textarea minRows={4} maxRows={10} maxLength={3000} value={description} placeholder="Was soll die App können? In welchem Zusammenhang würden Sie sie einsetzen?" onChange={(event) => setDescription(event.target.value)} />
            </Field>
            {error && (
              <Alert variant="plain" tone="destructive">
                <Alert.Icon />
                <Alert.Title>{error}</Alert.Title>
              </Alert>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close render={<Button type="button" variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
            <Button type="submit" form={formId} loading={saving} disabled={!title.trim()}>{editing ? 'Speichern' : 'Veröffentlichen'}</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function RespondDialog({
  item,
  apps,
  onClose,
  onSaved,
}: {
  item: Request;
  apps: AppConfig[];
  onClose: () => void;
  onSaved: (item: Request) => void;
}) {
  const formId = useId();
  const [status, setStatus] = useState<Status>(item.status);
  const [linkedAppId, setLinkedAppId] = useState(item.linkedAppId ?? '');
  const [response, setResponse] = useState(item.response);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const appItems = useMemo(
    () => apps.map((app) => ({ value: app.id, label: app.name })),
    [apps],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await request<Request>(`/requests/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, linkedAppId, response }),
      });
      onSaved(saved);
      onClose();
      toast.success('Antwort gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <Dialog.Content size="lg">
        <form id={formId} onSubmit={save} className="flex min-h-0 flex-col">
          <Dialog.Header title="Bedarfsmeldung beantworten" description={`„${item.title}“`} />
          <Dialog.Body className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Field.Label>Status</Field.Label>
                <Select items={STATUS_ITEMS} value={status} onValueChange={(value) => setStatus(value as Status)}>
                  <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                  <Select.Content>{STATUS_ITEMS.map((entry) => <Select.Item key={entry.value} value={entry.value}>{entry.label}</Select.Item>)}</Select.Content>
                </Select>
                <Field.Description>{STATUS[status].hint}</Field.Description>
              </Field>
              <Field>
                <Field.Label>Passende App</Field.Label>
                <Combobox
                  value={linkedAppId || undefined}
                  onValueChange={(value) => setLinkedAppId(value ?? '')}
                  placeholder="App suchen …"
                  emptyMessage="Keine passende App gefunden."
                  accessibilityLabel="Passende App"
                  clearable
                  openOnFocus
                >
                  {appItems.map((entry) => <Combobox.Item key={entry.value} value={entry.value} label={entry.label} />)}
                </Combobox>
                <Field.Description>Nur Apps, die im öffentlichen Katalog stehen.</Field.Description>
              </Field>
            </div>
            <Field>
              <Field.Label>Antwort an die Community</Field.Label>
              <Textarea minRows={3} maxRows={8} maxLength={1000} value={response} placeholder="z. B. „Dafür eignet sich Grafana4P; die Anleitung finden Sie dort unter Installation.“" onChange={(event) => setResponse(event.target.value)} />
            </Field>
            {error && (
              <Alert variant="plain" tone="destructive">
                <Alert.Icon />
                <Alert.Title>{error}</Alert.Title>
              </Alert>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Abbrechen</Button>
            <Button type="submit" form={formId} loading={saving}>Speichern</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}

function VoterAvatar({ name, username, src }: { name: string; username: string; src?: string }) {
  return (
    <Tooltip>
      <Tooltip.Trigger render={<Avatar name={name} src={src} tabIndex={0} />} />
      <Tooltip.Content>{username || name}</Tooltip.Content>
    </Tooltip>
  );
}

function RequestCard({
  item,
  busy,
  signedIn,
  onVote,
  onEdit,
  onRespond,
  onClose,
  onDelete,
}: {
  item: Request;
  busy: boolean;
  signedIn: boolean;
  onVote: () => void;
  onEdit: () => void;
  onRespond: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const status = STATUS[item.status];
  const author = { username: item.username || 'Unbekannt', displayName: item.displayName, avatarUrl: item.avatarUrl };
  const canEdit = item.canModerate || (item.mine && item.status === 'open');
  const hasMenu = canEdit || item.canRespond || item.mine || item.canModerate;

  return (
    <li className="flex gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.07] sm:gap-4 sm:p-5">
      {signedIn ? (
        <VoteButton item={item} disabled={busy} onVote={onVote} />
      ) : (
        <NextLink href="/login?callbackUrl=/bedarf" className="flex w-14 shrink-0 flex-col items-center gap-0.5 self-start rounded-xl bg-card py-2 ring-1 ring-foreground/10 hover:bg-muted/50" aria-label={`${item.votes} Stimmen – anmelden zum Abstimmen`}>
          <ArrowUp className="size-4" />
          <span className="text-base font-semibold tabular-nums leading-none">{item.votes}</span>
        </NextLink>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-pretty text-base font-semibold leading-snug">{item.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.variant} size="sm">{status.label}</Badge>
              {item.linkedAppId && item.linkedAppName && <AppChip id={item.linkedAppId} name={item.linkedAppName} icon={item.linkedAppIcon} />}
            </div>
          </div>
          {hasMenu && (
            <Menu>
              <Menu.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen" />}><MoreHorizontal /></Menu.Trigger>
              <Menu.Content align="end">
                {item.canRespond && <Menu.Item onClick={onRespond}><CheckCircle2 />Beantworten</Menu.Item>}
                {canEdit && <Menu.Item onClick={onEdit}><Pencil />Bearbeiten</Menu.Item>}
                {item.mine && item.status === 'open' && <Menu.Item onClick={onClose}><CircleDashed />Schließen</Menu.Item>}
                {(item.mine || item.canModerate) && <Menu.Item variant="destructive" onClick={onDelete}><Trash2 />Löschen</Menu.Item>}
              </Menu.Content>
            </Menu>
          )}
        </div>

        {item.description && <p className="whitespace-pre-line text-pretty text-sm text-muted-foreground">{item.description}</p>}

        {item.response && (
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">Antwort</p>
            <p className="whitespace-pre-line text-pretty">{item.response}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <UserAvatar user={author} size="xs" />
            <span className="truncate">{displayNameOf(author)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
          </div>
          {item.voters?.length > 0 && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
              <Avatar.Group max={5} size="xs" label="Diese Personen unterstützen die Bedarfsmeldung">
                {item.voters.map((voter) => (
                  <VoterAvatar
                    key={voter.id}
                    name={displayNameOf(voter)}
                    username={voter.username}
                    src={resolveAssetUrl(voter.avatarUrl) ?? undefined}
                  />
                ))}
              </Avatar.Group>
              </Tooltip.Provider>
              <span>{item.votes} Unterstützer</span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function RequestsContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<Request[] | null>(null);
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [tab, setTab] = useState('active');
  const [sort, setSort] = useState('votes');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Request | null>(null);
  const [responding, setResponding] = useState<Request | null>(null);
  const [deleting, setDeleting] = useState<Request | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      request<Request[]>(`/requests?sort=${sort}`)
        .then((data) => { if (active) { setItems(data); setError(''); } })
        .catch((err: Error) => { if (active) setError(err.message); });
    }, 0);
    return () => { active = false; window.clearTimeout(id); };
  }, [sort, user?.id]);

  useEffect(() => {
    let active = true;
    void loadApps().then((loaded) => { if (active) setApps(loaded.sort((a, b) => a.name.localeCompare(b.name, 'de'))); });
    return () => { active = false; };
  }, []);

  const replace = (saved: Request) => setItems((current) => (current ?? []).map((entry) => (entry.id === saved.id ? saved : entry)));
  const insert = (saved: Request) => setItems((current) => [saved, ...(current ?? [])]);

  const vote = async (item: Request) => {
    setBusyId(item.id);
    try {
      replace(await request<Request>(`/requests/${item.id}/vote`, { method: item.voted ? 'DELETE' : 'POST' }));
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Die Stimme konnte nicht gespeichert werden.');
    } finally {
      setBusyId(null);
    }
  };

  const closeRequest = async (item: Request) => {
    try {
      replace(await request<Request>(`/requests/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) }));
      toast.success('Bedarfsmeldung geschlossen.');
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Das Schließen ist fehlgeschlagen.');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await request<void>(`/requests/${deleting.id}`, { method: 'DELETE' });
      setItems((current) => (current ?? []).filter((entry) => entry.id !== deleting.id));
      setDeleting(null);
      toast.success('Bedarfsmeldung gelöscht.');
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Das Löschen ist fehlgeschlagen.');
    } finally {
      setDeletingBusy(false);
    }
  };

  const counts = useMemo(() => ({
    active: (items ?? []).filter((item) => item.status === 'open' || item.status === 'planned').length,
    fulfilled: (items ?? []).filter((item) => item.status === 'fulfilled').length,
    all: (items ?? []).length,
  }), [items]);

  const visible = (items ?? [])
    .filter((item) => (tab === 'all' ? true : tab === 'fulfilled' ? item.status === 'fulfilled' : item.status === 'open' || item.status === 'planned'))
    .sort((a, b) => (sort === 'votes' ? b.votes - a.votes : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const signedIn = Boolean(user);

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Lightbulb className="size-4" />Bedarfsmeldungen</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Was fehlt im Katalog?</h1>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            Sagen Sie, wofür Sie eine App suchen. Wer das Gleiche braucht, stimmt zu – und wer eine passende Lösung kennt oder anbietet, antwortet hier.
          </p>
        </div>
        {signedIn ? (
          <Button size="lg" className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus />
            Neue Bedarfsmeldung
          </Button>
        ) : (
          <Button size="lg" variant="secondary" className="shrink-0" render={<NextLink href="/login?callbackUrl=/bedarf" />}>
            Anmelden, um mitzumachen
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <Tabs.List aria-label="Bedarfsmeldungen filtern">
            {TABS.map((entry) => (
              <Tabs.Trigger key={entry.value} value={entry.value}>
                {entry.label} <Tabs.Badge>{counts[entry.value as keyof typeof counts]}</Tabs.Badge>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
        <Select items={SORTS} value={sort} onValueChange={(value) => setSort(String(value))}>
          <Select.Trigger variant="ghost" size="sm" aria-label="Sortieren"><Select.Value /></Select.Trigger>
          <Select.Content align="end">{SORTS.map((entry) => <Select.Item key={entry.value} value={entry.value}>{entry.label}</Select.Item>)}</Select.Content>
        </Select>
      </div>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      {items === null && !error ? (
        <div className="flex flex-col gap-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : error && items === null ? null : visible.length === 0 ? (
        <Card>
          <Card.Content className="flex flex-col items-center gap-2 py-12 text-center">
            <Lightbulb className="size-8 text-muted-foreground/60" />
            <p className="font-medium">{tab === 'fulfilled' ? 'Noch keine erfüllte Bedarfsmeldung.' : tab === 'all' ? 'Noch keine Bedarfsmeldung.' : 'Noch keine offene Bedarfsmeldung.'}</p>
            <p className="max-w-md text-sm text-muted-foreground">Fehlt Ihnen etwas im Katalog? Melden Sie es – so sehen Anbieter und Teams, wo Bedarf besteht.</p>
            {signedIn && <Button className="mt-2" onClick={() => setCreateOpen(true)}><Plus />Neue Bedarfsmeldung</Button>}
          </Card.Content>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              signedIn={signedIn}
              busy={busyId === item.id}
              onVote={() => void vote(item)}
              onEdit={() => setEditing(item)}
              onRespond={() => setResponding(item)}
              onClose={() => void closeRequest(item)}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </ul>
      )}

      {createOpen && <RequestDialog open onOpenChange={setCreateOpen} editing={null} existing={items ?? []} apps={apps} onSaved={insert} />}
      {editing && <RequestDialog open onOpenChange={(open) => { if (!open) setEditing(null); }} editing={editing} existing={[]} apps={[]} onSaved={replace} />}
      {responding && <RespondDialog item={responding} apps={apps} onClose={() => setResponding(null)} onSaved={replace} />}
      <ConfirmDialog
        isOpen={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Bedarfsmeldung löschen?"
        description={deleting ? `„${deleting.title}“ und alle Stimmen dazu werden gelöscht.` : ''}
        confirmLabel="Löschen"
        isDanger
        isLoading={deletingBusy}
        onConfirm={remove}
      />
    </div>
  );
}

export default function RequestsPage() {
  return (
    <AppStoreGate>
      <Suspense fallback={null}>
        <RequestsContent />
      </Suspense>
    </AppStoreGate>
  );
}
