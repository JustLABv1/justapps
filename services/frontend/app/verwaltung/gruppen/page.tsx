'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Checkbox } from '@/components/panelui/checkbox';
import { Dialog } from '@/components/panelui/dialog';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Textarea } from '@/components/panelui/textarea';
import { Tooltip } from '@/components/panelui/tooltip';
import type { AppConfig } from '@/config/apps';
import { fetchApi, uploadFile } from '@/lib/api';
import { groupColor, groupInitials, type AppGroup } from '@/lib/appGroups';
import { getAppStatusMeta, isDraftStatus } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import { toast } from '@/lib/toast';
import { ExternalLink, ImageUp, Layers2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

async function messageOf(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message || fallback;
}

/** A group's mark: its uploaded icon, an emoji, or its initials in its own colour. */
function GroupMark({ group, size = 'md' }: { group: AppGroup; size?: 'sm' | 'md' | 'lg' }) {
  const src = getImageAssetUrl(group.icon);
  const box = size === 'lg' ? 'size-14 rounded-2xl text-lg' : size === 'sm' ? 'size-8 rounded-lg text-xs' : 'size-10 rounded-xl text-sm';
  return (
    <span
      aria-hidden="true"
      style={{ '--group': groupColor(group.id) } as CSSProperties}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[color-mix(in_oklab,var(--group)_16%,var(--card))] font-semibold text-[var(--group)] ${box}`}
    >
      {src ? <Image src={src} alt="" fill sizes="56px" className="object-contain p-1.5" unoptimized /> : group.icon || groupInitials(group.name)}
    </span>
  );
}

function AppIcon({ app }: { app: AppConfig }) {
  const src = getImageAssetUrl(app.icon);
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
      {src ? <Image src={src} alt="" fill sizes="36px" className="object-contain p-1" unoptimized /> : app.icon || '🏛️'}
    </span>
  );
}

function GroupDialog({
  group,
  open,
  onOpenChange,
  onSaved,
}: {
  group: AppGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id?: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploaded = !!getImageAssetUrl(icon);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setName(group?.name ?? '');
      setDescription(group?.description ?? '');
      setIcon(group?.icon ?? '');
    }, 0);
    return () => window.clearTimeout(id);
  }, [group, open]);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setIcon(await uploadFile('/upload/logo', file));
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Das Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || undefined, icon: icon.trim() || undefined });
      const response = group
        ? await fetchApi(`/app-groups/${group.id}`, { method: 'PUT', body })
        : await fetchApi('/app-groups', { method: 'POST', body });
      if (!response.ok) throw new Error(await messageOf(response, 'Die Gruppe konnte nicht gespeichert werden.'));
      const saved = await response.json().catch(() => ({})) as { id?: string };
      toast.success(group ? 'Gruppe gespeichert.' : 'Gruppe angelegt.');
      onOpenChange(false);
      onSaved(saved.id ?? group?.id);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Die Gruppe konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const preview: AppGroup = { id: group?.id ?? name, name: name || '?', icon };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <Dialog.Content>
        <Dialog.Header
          title={group ? 'Gruppe bearbeiten' : 'Neue Gruppe'}
          description="Gruppen bündeln Apps zu einem Thema oder Programm und haben eine eigene Seite im Katalog."
        />
        <Dialog.Body>
          <form id="group-form" onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <Field.Label required>Name</Field.Label>
              <Input required autoFocus maxLength={80} value={name} placeholder="z. B. KI-Werkzeuge" onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field>
              <Field.Label optional>Beschreibung</Field.Label>
              <Textarea rows={3} value={description} placeholder="Wofür die Gruppe steht – erscheint auf ihrer Seite." onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field>
              <Field.Label optional>Symbol</Field.Label>
              <div className="flex items-center gap-3">
                <GroupMark group={preview} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileInput.current?.click()}>
                      <ImageUp />
                      Bild hochladen
                    </Button>
                    {icon && (
                      <Button size="sm" variant="ghost" onClick={() => setIcon('')}>
                        <X />
                        Entfernen
                      </Button>
                    )}
                  </div>
                  {!uploaded && (
                    <Input
                      size="sm"
                      aria-label="Emoji als Symbol"
                      maxLength={4}
                      value={icon}
                      placeholder="oder ein Emoji, z. B. 🤖"
                      onChange={(event) => setIcon(event.target.value)}
                    />
                  )}
                </div>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => void upload(event.target.files?.[0])} />
              </div>
              <Field.Description>Ohne Symbol zeigt die Gruppe ihre Anfangsbuchstaben in einer eigenen Farbe.</Field.Description>
            </Field>
          </form>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
          <Button type="submit" form="group-form" loading={saving} disabled={!name.trim() || uploading}>{group ? 'Speichern' : 'Anlegen'}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

function AddAppsDialog({
  group,
  apps,
  open,
  onOpenChange,
  onAdded,
}: {
  group: AppGroup;
  apps: AppConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de');
    return apps
      .filter((app) => !app.appGroups?.some((entry) => entry.id === group.id))
      .filter((app) => !query || [app.name, app.id, ...(app.categories ?? [])].some((value) => value.toLocaleLowerCase('de').includes(query)));
  }, [apps, group.id, search]);

  const allVisibleSelected = candidates.length > 0 && candidates.every((app) => selected.has(app.id));

  const toggle = (id: string, checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });

  const add = async () => {
    setSaving(true);
    try {
      const response = await fetchApi(`/app-groups/${group.id}/members`, { method: 'POST', body: JSON.stringify({ appIds: Array.from(selected) }) });
      if (!response.ok) throw new Error(await messageOf(response, 'Die Apps konnten nicht hinzugefügt werden.'));
      toast.success(`${selected.size} ${selected.size === 1 ? 'App' : 'Apps'} zu „${group.name}“ hinzugefügt.`);
      onOpenChange(false);
      onAdded();
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Die Apps konnten nicht hinzugefügt werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
        if (!next) { setSearch(''); setSelected(new Set()); }
      }}
    >
      <Dialog.Content size="lg">
        <Dialog.Header title={`Apps zu „${group.name}“ hinzufügen`} description="Apps können zu mehreren Gruppen gehören." />
        <Dialog.Body className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input.Group size="sm" className="min-w-0 flex-1">
              <Input.Addon><Search /></Input.Addon>
              <Input aria-label="Apps durchsuchen" placeholder="Name oder Kategorie" value={search} onChange={(event) => setSearch(event.target.value)} />
            </Input.Group>
            <Button
              size="sm"
              variant="ghost"
              disabled={candidates.length === 0}
              onClick={() => setSelected((previous) => {
                const next = new Set(previous);
                candidates.forEach((app) => (allVisibleSelected ? next.delete(app.id) : next.add(app.id)));
                return next;
              })}
            >
              {allVisibleSelected ? 'Keine' : 'Alle sichtbaren'}
            </Button>
          </div>
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
            {candidates.map((app) => {
              const status = getAppStatusMeta(app.status);
              return (
                <li key={app.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50">
                    <Checkbox label={app.name} checked={selected.has(app.id)} onCheckedChange={(checked) => toggle(app.id, Boolean(checked))} />
                    <AppIcon app={app} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{app.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{(app.categories ?? []).join(', ') || app.id}</span>
                    </span>
                    {isDraftStatus(app.status) ? <Badge variant="secondary" size="sm">Entwurf</Badge> : status && <span className="text-xs text-muted-foreground">{status.label}</span>}
                  </label>
                </li>
              );
            })}
            {candidates.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'Keine passende App.' : 'Alle Apps gehören schon zu dieser Gruppe.'}
              </li>
            )}
          </ul>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
          <Button disabled={selected.size === 0} loading={saving} onClick={() => void add()}>
            {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'App' : 'Apps'} hinzufügen` : 'Hinzufügen'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

function GroupsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; group: AppGroup | null }>({ open: false, group: null });
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [groupResponse, appResponse] = await Promise.all([
        fetchApi('/app-groups', { cache: 'no-store' }),
        fetchApi('/apps', { cache: 'no-store' }),
      ]);
      if (!groupResponse.ok || !appResponse.ok) throw new Error('Gruppen konnten nicht geladen werden.');
      const groupData = await groupResponse.json();
      const appData = await appResponse.json();
      setGroups((Array.isArray(groupData) ? groupData as AppGroup[] : []).sort((a, b) => a.name.localeCompare(b.name, 'de')));
      setApps((Array.isArray(appData) ? appData as AppConfig[] : []).sort((a, b) => a.name.localeCompare(b.name, 'de')));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const membersOf = useCallback(
    (groupId: string) => apps.filter((app) => app.appGroups?.some((entry) => entry.id === groupId)),
    [apps],
  );

  const select = useCallback((id: string | null) => {
    const query = new URLSearchParams(params.toString());
    if (id) query.set('gruppe', id); else query.delete('gruppe');
    router.replace(`${pathname}${query.size ? `?${query}` : ''}`, { scroll: false });
  }, [params, pathname, router]);

  const visibleGroups = groups.filter((group) => {
    const query = search.trim().toLocaleLowerCase('de');
    return !query || group.name.toLocaleLowerCase('de').includes(query) || (group.description ?? '').toLocaleLowerCase('de').includes(query);
  });
  const selected = groups.find((group) => group.id === params.get('gruppe')) ?? visibleGroups[0] ?? null;
  const members = selected ? membersOf(selected.id) : [];

  const removeMember = async (app: AppConfig) => {
    if (!selected) return;
    setRemoving(app.id);
    try {
      const response = await fetchApi(`/app-groups/${selected.id}/members/${encodeURIComponent(app.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await messageOf(response, 'Die App konnte nicht entfernt werden.'));
      toast.success(`„${app.name}“ aus „${selected.name}“ entfernt.`);
      await load();
    } catch (removeError) {
      toast.danger(removeError instanceof Error ? removeError.message : 'Die App konnte nicht entfernt werden.');
    } finally {
      setRemoving(null);
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetchApi(`/app-groups/${deleteTarget.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await messageOf(response, 'Die Gruppe konnte nicht gelöscht werden.'));
      toast.success('Gruppe gelöscht.');
      setDeleteTarget(null);
      select(null);
      await load();
    } catch (deleteError) {
      toast.danger(deleteError instanceof Error ? deleteError.message : 'Die Gruppe konnte nicht gelöscht werden.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">App-Gruppen</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Gruppen bündeln Apps zu einem Thema oder Programm. Jede hat eine eigene Seite unter{' '}
            <NextLink href="/gruppen" className="font-medium text-foreground underline underline-offset-4">Gruppen</NextLink>.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, group: null })}>
          <Plus />
          Neue Gruppe
        </Button>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
          <Alert.Actions><Button size="sm" variant="secondary" onClick={() => void load()}>Erneut versuchen</Button></Alert.Actions>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <span className="h-80 animate-pulse rounded-2xl bg-muted" />
          <span className="h-80 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers2 className="size-5" /></span>
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Noch keine Gruppen</h2>
            <p className="max-w-sm text-sm text-muted-foreground">Legen Sie eine Gruppe an, etwa für ein Programm, ein Thema oder eine Behörde.</p>
          </div>
          <Button onClick={() => setDialog({ open: true, group: null })}><Plus />Neue Gruppe</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <Card className="gap-0 py-0 lg:sticky lg:top-24">
            <div className="border-b p-3">
              <Input.Group size="sm">
                <Input.Addon><Search /></Input.Addon>
                <Input aria-label="Gruppen durchsuchen" placeholder={`${groups.length} Gruppen durchsuchen`} value={search} onChange={(event) => setSearch(event.target.value)} />
              </Input.Group>
            </div>
            <ul aria-label="Gruppen" className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto p-2">
              {visibleGroups.map((group) => {
                const active = selected?.id === group.id;
                return (
                  <li key={group.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => select(group.id)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted' : 'hover:bg-muted/50'}`}
                    >
                      <GroupMark group={group} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{group.name}</span>
                        <span className="text-xs text-muted-foreground">{membersOf(group.id).length} {membersOf(group.id).length === 1 ? 'App' : 'Apps'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {visibleGroups.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Keine Gruppe gefunden.</li>}
            </ul>
          </Card>

          {selected && (
            <Card className="gap-0 py-0">
              <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start">
                <GroupMark group={selected} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm text-pretty text-muted-foreground">{selected.description || 'Ohne Beschreibung.'}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Tooltip>
                    <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Öffentliche Seite ansehen" render={<NextLink href={`/gruppen/${selected.id}`} />} />}>
                      <ExternalLink />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Öffentliche Seite</Tooltip.Content>
                  </Tooltip>
                  <Tooltip>
                    <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Gruppe bearbeiten" onClick={() => setDialog({ open: true, group: selected })} />}>
                      <Pencil />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Bearbeiten</Tooltip.Content>
                  </Tooltip>
                  <Tooltip>
                    <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="Gruppe löschen" onClick={() => setDeleteTarget(selected)} />}>
                      <Trash2 />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Löschen</Tooltip.Content>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
                <h3 className="text-sm font-medium text-muted-foreground">{members.length} {members.length === 1 ? 'App' : 'Apps'}</h3>
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus />
                  Apps hinzufügen
                </Button>
              </div>
              {members.length === 0 ? (
                <p className="px-5 pt-4 pb-10 text-center text-sm text-muted-foreground">Noch keine Apps in dieser Gruppe.</p>
              ) : (
                <ul className="divide-y px-2 pb-2">
                  {members.map((app) => (
                    <li key={app.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                      <AppIcon app={app} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <NextLink href={`/verwaltung/katalog/apps/${app.id}/edit`} className="w-fit truncate text-sm font-medium underline-offset-4 hover:underline">
                          {app.name}
                        </NextLink>
                        <span className="truncate text-xs text-muted-foreground">{(app.categories ?? []).join(', ') || app.id}</span>
                      </span>
                      {isDraftStatus(app.status) && <Badge variant="secondary" size="sm">Entwurf</Badge>}
                      <Tooltip>
                        <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" loading={removing === app.id} aria-label={`${app.name} aus der Gruppe entfernen`} onClick={() => void removeMember(app)} />}>
                          <X />
                        </Tooltip.Trigger>
                        <Tooltip.Content>Aus der Gruppe entfernen</Tooltip.Content>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}

      <GroupDialog
        group={dialog.group}
        open={dialog.open}
        onOpenChange={(open) => setDialog((previous) => ({ ...previous, open }))}
        onSaved={(id) => { void load(); if (id) select(id); }}
      />
      {selected && <AddAppsDialog group={selected} apps={apps} open={addOpen} onOpenChange={setAddOpen} onAdded={() => void load()} />}
      <ConfirmDialog
        confirmLabel="Gruppe löschen"
        description={deleteTarget ? `„${deleteTarget.name}“ wird gelöscht. Die Apps selbst bleiben erhalten.` : ''}
        isDanger
        isLoading={deleting}
        isOpen={!!deleteTarget}
        onConfirm={deleteGroup}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
        title="Gruppe löschen?"
      />
    </div>
  );
}

export default function VerwaltungGruppenPage() {
  return (
    <Suspense fallback={null}>
      <GroupsContent />
    </Suspense>
  );
}
