'use client';

import { AppEditorsModal } from '@/components/AppEditorsModal';
import { AppHealthCopilot } from '@/components/AppHealthCopilot';
import { MoveAppDialog } from '@/components/MoveAppDialog';
import { getReadiness } from '@/components/app-editor/readiness';
import { Alert } from '@/components/panelui/alert';
import { AlertDialog } from '@/components/panelui/alert-dialog';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Input } from '@/components/panelui/input';
import { Menu } from '@/components/panelui/menu';
import { Select } from '@/components/panelui/select';
import { Spinner } from '@/components/panelui/spinner';
import { Tabs } from '@/components/panelui/tabs';
import { Tooltip } from '@/components/panelui/tooltip';
import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { getRelativeTimeMeta } from '@/lib/appFreshness';
import { getAppHealthIssueColor, getAppHealthIssueDescription, getAppHealthIssueLabel } from '@/lib/appHealth';
import { getAppStatusMeta, isDraftStatus, STATUS_BADGE_VARIANT } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import { toast } from '@/lib/toast';
import {
  ArrowUpDown, CircleAlert, CircleCheck, Copy, ExternalLink, Eye, EyeOff, FolderInput, Globe, Lock, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound, X,
} from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

interface MyAppHealthRow {
  appId: string;
  name?: string;
  health: 'healthy' | 'attention' | 'critical' | string;
  issues: string[];
  linkProbeStatus?: string;
  syncStatus?: string;
  syncError?: string;
}

interface MyAppsHealthResponse {
  generatedAt: string;
  total: number;
  healthy: number;
  attention: number;
  critical: number;
  apps: MyAppHealthRow[];
}

type Filter = 'all' | 'drafts' | 'published' | 'attention';
type Sort = 'updated' | 'name' | 'status';

const SORT_ITEMS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Zuletzt geändert' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
];

function AppLogo({ app }: { app: AppConfig }) {
  const src = getImageAssetUrl(app.icon);
  return (
    <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40 text-2xl">
      {src ? <Image src={src} alt="" fill sizes="48px" className="object-contain p-1.5" unoptimized /> : app.icon || '🏛️'}
    </span>
  );
}

function RowSkeleton() {
  return (
    <li className="flex animate-pulse items-center gap-4 px-4 py-4 sm:px-5">
      <span className="size-12 shrink-0 rounded-xl bg-muted" />
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-48 rounded bg-muted" />
        <span className="h-3 w-full max-w-md rounded bg-muted" />
      </span>
      <span className="hidden h-8 w-28 rounded-lg bg-muted sm:block" />
    </li>
  );
}

function MyAppsContent() {
  const { user, loading: authLoading, profileReady, profileError, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [health, setHealth] = useState<MyAppsHealthResponse | null>(null);
  const [settings, setSettings] = useState({ allowAppSubmissions: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishCandidate, setPublishCandidate] = useState<AppConfig | null>(null);
  const [moveCandidate, setMoveCandidate] = useState<AppConfig | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AppConfig | null>(null);
  const [editorApp, setEditorApp] = useState<AppConfig | null>(null);
  const [visibilityPending, setVisibilityPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('updated');

  // Signed out: back to the catalogue.
  useEffect(() => {
    if (authLoading || user) return;
    const timer = setTimeout(() => router.push('/'), 500);
    return () => clearTimeout(timer);
  }, [user, authLoading, router]);

  // ?edit=<id> deep links go straight to the editor.
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId) router.replace(`/meine-apps/${editId}/edit`);
  }, [searchParams, router]);

  const loadData = async () => {
    if (!user || !profileReady) return;
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, appsRes, healthRes] = await Promise.all([
        fetchApi('/settings'),
        fetchApi('/apps?editable=me'),
        fetchApi('/apps/health'),
      ]);
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (appsRes.ok) setApps(await appsRes.json() as AppConfig[]);
      else setError(`Deine Apps konnten nicht geladen werden (${appsRes.statusText || appsRes.status}).`);
      setHealth(healthRes.ok ? await healthRes.json() as MyAppsHealthResponse : null);
    } catch (err) {
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileReady) return;
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileReady]);

  const isAdmin = user?.role === 'admin';
  const submissionsBlocked = !isAdmin && (!user?.canSubmitApps || !settings.allowAppSubmissions);
  const submissionBlockReason = !settings.allowAppSubmissions && !isAdmin
    ? 'App-Einreichungen sind derzeit für alle deaktiviert.'
    : !user?.canSubmitApps && !isAdmin
      ? 'Dein Konto ist nicht für neue Apps freigeschaltet.'
      : null;

  const permissionsOf = (app: AppConfig) => {
    const ownerOrAdmin = isAdmin || app.ownerId === user?.id;
    return {
      canEdit: app.viewerPermissions?.canEdit ?? ownerOrAdmin,
      canDelete: app.viewerPermissions?.canDelete ?? ownerOrAdmin,
      canManageEditors: app.viewerPermissions?.canManageEditors ?? ownerOrAdmin,
      canCopy: ownerOrAdmin,
      // Moving changes who can see the app at all, so it stays with the owner and admins (the server checks the same).
      canMove: ownerOrAdmin,
      accessRole: app.viewerPermissions?.accessRole ?? (ownerOrAdmin ? (isAdmin ? 'admin' : 'owner') : 'viewer'),
    };
  };

  const ensureCanSubmit = async () => {
    if (!profileReady && !(await refreshUser())) {
      toast.danger('Dein Benutzerprofil ist noch nicht bereit. Bitte versuch es gleich noch einmal.');
      return false;
    }
    if (submissionBlockReason) {
      toast.info(submissionBlockReason);
      return false;
    }
    return true;
  };

  const createApp = async () => {
    if (await ensureCanSubmit()) router.push('/meine-apps/new');
  };

  const copyApp = async (app: AppConfig) => {
    if (permissionsOf(app).canCopy && (await ensureCanSubmit())) router.push(`/meine-apps/new?copy=${encodeURIComponent(app.id)}`);
  };

  const changeVisibility = async (app: AppConfig, isHidden: boolean) => {
    if (!permissionsOf(app).canEdit || visibilityPending.has(app.id)) return;
    setVisibilityPending((current) => new Set(current).add(app.id));
    setApps((current) => current.map((entry) => (entry.id === app.id ? { ...entry, isHidden } : entry)));
    try {
      const response = await fetchApi(`/apps/${app.id}/visibility`, { method: 'PATCH', body: JSON.stringify({ isHidden }) });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Die Sichtbarkeit konnte nicht geändert werden.');
      }
      toast.success(isHidden ? `„${app.name}“ ist jetzt versteckt.` : `„${app.name}“ ist wieder sichtbar.`);
    } catch (err) {
      setApps((current) => current.map((entry) => (entry.id === app.id ? { ...entry, isHidden: app.isHidden } : entry)));
      toast.danger(err instanceof Error ? err.message : 'Die Sichtbarkeit konnte nicht geändert werden.');
    } finally {
      setVisibilityPending((current) => {
        const next = new Set(current);
        next.delete(app.id);
        return next;
      });
    }
  };

  const deleteApp = async () => {
    if (!deleteCandidate) return;
    const response = await fetchApi(`/apps/${deleteCandidate.id}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      toast.danger('Die App konnte nicht gelöscht werden.');
      throw new Error('delete failed');
    }
    toast.success(`„${deleteCandidate.name}“ wurde gelöscht.`);
    setDeleteCandidate(null);
    await loadData();
  };

  const publishFromSpace = async () => {
    if (!publishCandidate) return;
    const response = await fetchApi(`/apps/${publishCandidate.id}/publish`, { method: 'POST' }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => ({})) as { message?: string } | undefined;
      toast.danger(body?.message || 'Die Veröffentlichung ist fehlgeschlagen.');
      throw new Error('publish failed');
    }
    toast.success('Die App ist jetzt für alle sichtbar.');
    setPublishCandidate(null);
    await loadData();
  };

  const healthById = useMemo(() => new Map((health?.apps || []).map((row) => [row.appId, row])), [health]);
  const needsAttention = (app: AppConfig) => (healthById.get(app.id)?.issues.length ?? 0) > 0;
  const counts = {
    all: apps.length,
    drafts: apps.filter((app) => isDraftStatus(app.status)).length,
    published: apps.filter((app) => !isDraftStatus(app.status)).length,
    attention: apps.filter(needsAttention).length,
  };

  const visibleApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apps
      .filter((app) => filter === 'all'
        || (filter === 'drafts' && isDraftStatus(app.status))
        || (filter === 'published' && !isDraftStatus(app.status))
        || (filter === 'attention' && (healthById.get(app.id)?.issues.length ?? 0) > 0))
      .filter((app) => !needle || [app.name, app.id, app.description, ...(app.categories || [])].some((value) => value?.toLowerCase().includes(needle)))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'de');
        if (sort === 'status') return (getAppStatusMeta(a.status)?.sortOrder ?? 0) - (getAppStatusMeta(b.status)?.sortOrder ?? 0) || a.name.localeCompare(b.name, 'de');
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
  }, [apps, filter, query, sort, healthById]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
        <Spinner />
        Anmeldung wird geprüft …
      </div>
    );
  }
  if (!user) return null;

  if (!profileReady) {
    return (
      <Alert tone="warning" className="mx-auto max-w-2xl">
        <Alert.Icon />
        <Alert.Title>Dein Profil wird noch synchronisiert</Alert.Title>
        <Alert.Description>{profileError || 'Nach der Anmeldung wird dein Benutzerprofil mit dem Server abgeglichen. Versuch es in ein paar Sekunden noch einmal.'}</Alert.Description>
        <Alert.Actions>
          <Button size="sm" onClick={() => void refreshUser()}>Erneut laden</Button>
        </Alert.Actions>
      </Alert>
    );
  }

  const newAppButton = (
    <Button disabled={submissionsBlocked} onClick={() => void createApp()}>
      <Plus />
      Neue App
    </Button>
  );

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Meine Apps</h1>
          <p className="text-muted-foreground">Apps, die dir gehören oder die du bearbeiten darfst.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<NextLink href="/spaces" />}>
            <Lock />
            Private Spaces
          </Button>
          {submissionBlockReason ? (
            <Tooltip>
              <Tooltip.Trigger render={<span tabIndex={0} className="inline-flex" />}>{newAppButton}</Tooltip.Trigger>
              <Tooltip.Content>{submissionBlockReason}</Tooltip.Content>
            </Tooltip>
          ) : newAppButton}
        </div>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
          <Alert.Actions>
            <Button size="sm" variant="outline" onClick={() => void loadData()}>Erneut versuchen</Button>
          </Alert.Actions>
        </Alert>
      )}

      {/* ── Toolbar: what to show, search, order ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <Tabs.List aria-label="Apps filtern">
            <Tabs.Trigger value="all">Alle<Tabs.Badge>{counts.all}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="drafts">Entwürfe<Tabs.Badge>{counts.drafts}</Tabs.Badge></Tabs.Trigger>
            <Tabs.Trigger value="published">Veröffentlicht<Tabs.Badge>{counts.published}</Tabs.Badge></Tabs.Trigger>
            {health && (
              <Tabs.Trigger value="attention">
                {counts.attention > 0 ? <CircleAlert className="text-warning" /> : <CircleCheck className="text-success" />}
                Hinweise
                <Tabs.Badge>{counts.attention}</Tabs.Badge>
              </Tabs.Trigger>
            )}
          </Tabs.List>
        </Tabs>
        <div className="flex flex-1 items-center gap-2">
          <Input.Group className="min-w-0 flex-1 lg:ms-auto lg:max-w-xs">
            <Input.Addon><Search /></Input.Addon>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Apps durchsuchen" aria-label="Apps durchsuchen" />
            {query && (
              <Input.Addon align="end">
                <button type="button" aria-label="Suche löschen" onClick={() => setQuery('')} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </Input.Addon>
            )}
          </Input.Group>
          <Select items={SORT_ITEMS} value={sort} onValueChange={(value) => value && setSort(value as Sort)}>
            <Select.Trigger variant="ghost" size="sm" aria-label="Apps sortieren">
              <ArrowUpDown />
              <Select.Value />
            </Select.Trigger>
            <Select.Content align="end">
              {SORT_ITEMS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
            </Select.Content>
          </Select>
        </div>
      </div>

      {filter === 'attention' && health && counts.attention > 0 && (
        <p className="text-sm text-muted-foreground">
          {health.critical > 0 && <span className="font-medium text-destructive">{health.critical} kritisch · </span>}
          Erreichbarkeit, Repository-Abgleich und Pflegezustand werden regelmäßig geprüft. Die AI-Schaltfläche erklärt, was zu tun ist.
        </p>
      )}

      {/* ── List ── */}
      {loading ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {[0, 1, 2].map((index) => <RowSkeleton key={index} />)}
        </ul>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Plus className="size-5" /></span>
          <div className="flex flex-col gap-1">
            <p className="font-medium">Noch keine Apps</p>
            <p className="text-sm text-muted-foreground">
              {submissionBlockReason ?? 'Leg deine erste App an. Das dauert drei kurze Schritte, alles Weitere kannst du später ergänzen.'}
            </p>
          </div>
          {!submissionsBlocked && <Button onClick={() => void createApp()}><Plus />Erste App anlegen</Button>}
        </div>
      ) : visibleApps.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center">
          <p className="font-medium">{filter === 'attention' && !query ? 'Keine offenen Hinweise' : 'Keine passende App'}</p>
          <p className="text-sm text-muted-foreground">
            {filter === 'attention' && !query ? 'Alle deine Apps sind erreichbar und gepflegt.' : 'Passe die Suche oder den Filter an.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {visibleApps.map((app) => {
            const permissions = permissionsOf(app);
            const status = getAppStatusMeta(app.status);
            const draft = isDraftStatus(app.status);
            const appHealth = healthById.get(app.id);
            const missing = draft ? getReadiness(app).filter((item) => item.required && !item.done).length : 0;
            const updated = getRelativeTimeMeta(app.updatedAt)?.label;
            const editHref = `/meine-apps/${app.id}/edit`;

            return (
              <li key={app.id} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <AppLogo app={app} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {permissions.canEdit ? (
                        <NextLink href={editHref} className="font-medium hover:underline hover:underline-offset-4">{app.name}</NextLink>
                      ) : (
                        <span className="font-medium">{app.name}</span>
                      )}
                      {status && <Badge variant={draft ? 'secondary' : STATUS_BADGE_VARIANT[status.color] ?? 'secondary'} size="sm" dot={!draft}>{status.label}</Badge>}
                      {app.spaceId && <Badge variant="outline" size="sm"><Lock />Privater Space</Badge>}
                      {app.isHidden && <Badge variant="warning" size="sm"><EyeOff />Versteckt</Badge>}
                      {app.isLocked && <Badge variant="warning" size="sm"><Lock />Gesperrt</Badge>}
                      {permissions.accessRole === 'editor' && <Badge variant="outline" size="sm"><UsersRound />Bearbeiter</Badge>}
                      {permissions.accessRole === 'moderator' && <Badge variant="outline" size="sm"><ShieldCheck />Moderation</Badge>}
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{app.description || 'Noch keine Kurzbeschreibung.'}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-xs text-muted-foreground">
                      {draft && missing > 0 && permissions.canEdit && (
                        <NextLink href={editHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                          Noch {missing} {missing === 1 ? 'Pflichtangabe' : 'Pflichtangaben'} bis zur Veröffentlichung
                        </NextLink>
                      )}
                      {draft && missing === 0 && <span className="text-success">Bereit zur Veröffentlichung</span>}
                      {appHealth && appHealth.issues.length === 0 && !draft && (
                        <span className="flex items-center gap-1"><CircleCheck className="size-3.5 text-success" />Alles in Ordnung</span>
                      )}
                      {appHealth?.issues.map((issue) => (
                        <Tooltip key={issue}>
                          <Tooltip.Trigger render={<span tabIndex={0} className="outline-none" />}>
                            <Badge variant={getAppHealthIssueColor(issue) === 'danger' ? 'destructive' : 'warning'} size="sm">
                              {getAppHealthIssueLabel(issue)}
                            </Badge>
                          </Tooltip.Trigger>
                          <Tooltip.Content>{getAppHealthIssueDescription(issue)}</Tooltip.Content>
                        </Tooltip>
                      ))}
                      {updated && <span>geändert {updated}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 ps-16 sm:ps-0">
                  {appHealth && appHealth.issues.length > 0 && (
                    <AppHealthCopilot
                      iconOnly
                      appId={app.id}
                      appName={app.name}
                      issues={appHealth.issues}
                      linkProbeStatus={appHealth.linkProbeStatus}
                      syncStatus={appHealth.syncStatus}
                      syncError={appHealth.syncError}
                    />
                  )}
                  {permissions.canEdit && (
                    <Button size="sm" variant={draft ? 'default' : 'outline'} render={<NextLink href={editHref} />}>
                      <Pencil />
                      {draft ? 'Weiter bearbeiten' : 'Bearbeiten'}
                    </Button>
                  )}
                  <Menu>
                    <Menu.Trigger render={<Button size="icon-sm" variant="ghost" aria-label={`Weitere Aktionen für ${app.name}`} />}>
                      <MoreHorizontal />
                    </Menu.Trigger>
                    <Menu.Content align="end">
                      <Menu.Item onClick={() => router.push(`/apps/${app.id}`)}><ExternalLink />Ansehen</Menu.Item>
                      {permissions.canCopy && <Menu.Item onClick={() => void copyApp(app)}><Copy />Als Vorlage kopieren</Menu.Item>}
                      {permissions.canManageEditors && <Menu.Item onClick={() => setEditorApp(app)}><UsersRound />Bearbeiter verwalten</Menu.Item>}
                      {permissions.canEdit && (
                        <Menu.Item disabled={visibilityPending.has(app.id)} onClick={() => void changeVisibility(app, !app.isHidden)}>
                          {app.isHidden ? <Eye /> : <EyeOff />}
                          {app.isHidden ? 'Wieder sichtbar machen' : 'Vorübergehend verstecken'}
                        </Menu.Item>
                      )}
                      {app.spaceId && app.ownerId === user.id && (
                        <Menu.Item disabled={app.isLocked} onClick={() => setPublishCandidate(app)}><Globe />Für alle veröffentlichen</Menu.Item>
                      )}
                      {permissions.canMove && (
                        <Menu.Item disabled={app.isLocked} onClick={() => setMoveCandidate(app)}><FolderInput />Verschieben …</Menu.Item>
                      )}
                      {permissions.canDelete && (
                        <>
                          <Menu.Separator />
                          <Menu.Item variant="destructive" onClick={() => setDeleteCandidate(app)}><Trash2 />Löschen</Menu.Item>
                        </>
                      )}
                    </Menu.Content>
                  </Menu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialog.Content tone="destructive">
          <AlertDialog.Title>„{deleteCandidate?.name}“ löschen?</AlertDialog.Title>
          <AlertDialog.Description>Die App wird mit allen Bewertungen und Fragen dauerhaft entfernt. Das lässt sich nicht rückgängig machen.</AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
            <AlertDialog.Action onClick={deleteApp}>Endgültig löschen</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      <AlertDialog open={!!publishCandidate} onOpenChange={(open) => { if (!open) setPublishCandidate(null); }}>
        <AlertDialog.Content tone="warning">
          <AlertDialog.Title>„{publishCandidate?.name}“ für alle veröffentlichen?</AlertDialog.Title>
          <AlertDialog.Description>Die App verlässt den privaten Space. Beschreibung, Dokumentation und Diskussionen sind danach im öffentlichen Katalog für alle sichtbar.</AlertDialog.Description>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
            <AlertDialog.Action onClick={publishFromSpace}>Veröffentlichen</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>

      <MoveAppDialog
        app={moveCandidate}
        open={!!moveCandidate}
        onOpenChange={(open) => { if (!open) setMoveCandidate(null); }}
        onMoved={() => void loadData()}
      />

      <AppEditorsModal
        key={editorApp?.id ?? 'no-editor-app'}
        app={editorApp}
        onOpenChange={(open) => { if (!open) setEditorApp(null); }}
        onSaved={loadData}
      />
    </div>
  );
}

export default function MyAppsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Spinner /></div>}>
      <MyAppsContent />
    </Suspense>
  );
}
