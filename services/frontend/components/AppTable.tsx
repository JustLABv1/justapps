'use client';

import { Avatar } from '@/components/panelui/avatar';
import { Badge, type BadgeVariant } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Checkbox } from '@/components/panelui/checkbox';
import { Input } from '@/components/panelui/input';
import { Menu } from '@/components/panelui/menu';
import { Pagination } from '@/components/panelui/pagination';
import { Select } from '@/components/panelui/select';
import { Table } from '@/components/panelui/table';
import { Tooltip } from '@/components/panelui/tooltip';
import { UserAvatar, authorName } from '@/components/profile/UserAvatar';
import { AppCatalogFilters, AppConfig, AppUserSummary } from '@/config/apps';
import { getAppStatusMeta, STATUS_BADGE_VARIANT } from '@/lib/appStatus';
import { getImageAssetUrl, resolveAssetUrl } from '@/lib/assets';
import {
  Copy,
  ExternalLink,
  Lock,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Unlock,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useMemo, useState } from 'react';

const ROWS_PER_PAGE = 15;
const ALL = '__all__';

const SYNC_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  success: { label: 'Synchronisiert', variant: 'success' },
  warning: { label: 'Mit Hinweisen', variant: 'warning' },
  pending_approval: { label: 'Wartet auf Freigabe', variant: 'warning' },
  error: { label: 'Fehler', variant: 'destructive' },
  never: { label: 'Noch nicht synchronisiert', variant: 'secondary' },
};

const SYNC_FILTER_OPTIONS = [
  { value: 'linked', label: 'Verknüpft' },
  { value: 'unlinked', label: 'Nicht verknüpft' },
  { value: 'success', label: 'Synchronisiert' },
  { value: 'warning', label: 'Mit Hinweisen' },
  { value: 'pending_approval', label: 'Wartet auf Freigabe' },
  { value: 'error', label: 'Fehler' },
  { value: 'never', label: 'Noch nicht synchronisiert' },
];

interface AppTableProps {
  apps: AppConfig[];
  categoryOptions: string[];
  filters: AppCatalogFilters;
  isLoading?: boolean;
  ownerOptions: AppUserSummary[];
  handleEditApp: (app: AppConfig) => void;
  handleDeleteApp: (id: string) => void;
  handleToggleAppLock: (app: AppConfig) => void;
  handleCopyApp?: (app: AppConfig) => void;
  handleTransferApp?: (app: AppConfig) => void;
  handleManageEditors?: (app: AppConfig) => void;
  onFilterChange: (updates: Partial<AppCatalogFilters>) => void;
  onResetFilters: () => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkToggleLock?: (ids: string[], lock: boolean) => void;
  statusOptions: string[];
}

/** A filter as a Select whose first option clears it. */
function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const items = [{ value: ALL, label: allLabel }, ...options];
  return (
    <Select items={items} value={value || ALL} onValueChange={(next) => onChange(next && next !== ALL ? String(next) : '')}>
      <Select.Trigger size="sm" aria-label={label} className={className ?? 'w-full sm:w-44'}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {items.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
      </Select.Content>
    </Select>
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

function Editors({ editors }: { editors?: AppUserSummary[] }) {
  if (!editors?.length) return <span className="text-muted-foreground">–</span>;
  return (
    <Avatar.Group max={3} size="xs" label="Bearbeiter">
      {editors.map((editor) => (
        <Avatar
          key={editor.id}
          name={authorName(editor)}
          src={resolveAssetUrl(editor.avatarUrl) ?? undefined}
        />
      ))}
    </Avatar.Group>
  );
}

function RowSkeleton() {
  return (
    <Table.Row>
      <Table.Cell><span className="block size-4 animate-pulse rounded bg-muted" /></Table.Cell>
      <Table.Cell>
        <span className="flex items-center gap-3">
          <span className="size-9 animate-pulse rounded-lg bg-muted" />
          <span className="flex flex-col gap-1.5">
            <span className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <span className="h-3 w-20 animate-pulse rounded bg-muted" />
          </span>
        </span>
      </Table.Cell>
      {[0, 1, 2, 3, 4].map((index) => (
        <Table.Cell key={index}><span className="block h-4 w-20 animate-pulse rounded bg-muted" /></Table.Cell>
      ))}
    </Table.Row>
  );
}

export function AppTable({
  apps,
  categoryOptions,
  filters,
  isLoading,
  ownerOptions,
  handleEditApp,
  handleDeleteApp,
  handleToggleAppLock,
  handleCopyApp,
  handleTransferApp,
  handleManageEditors,
  onFilterChange,
  onResetFilters,
  onBulkDelete,
  onBulkToggleLock,
  statusOptions,
}: AppTableProps) {
  const filterKey = Object.values(filters).join('|');
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const hasAdvancedFilters = Boolean(filters.hasEditors || filters.syncStatus || filters.featured || filters.locked || filters.visibility);
  const [moreFilters, setMoreFilters] = useState(hasAdvancedFilters);
  const hasFilters = Object.values(filters).some(Boolean);

  const pageCount = Math.max(1, Math.ceil(apps.length / ROWS_PER_PAGE));
  const page = Math.min(paging.key === filterKey ? paging.page : 1, pageCount);
  const rows = apps.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // A selection only ever holds apps that are still in the list.
  const selection = useMemo(() => {
    const ids = new Set(apps.map((app) => app.id));
    return Array.from(selected).filter((id) => ids.has(id));
  }, [apps, selected]);
  const pageSelected = rows.filter((app) => selection.includes(app.id)).length;

  const togglePage = (checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    rows.forEach((app) => (checked ? next.add(app.id) : next.delete(app.id)));
    return next;
  });
  const toggleRow = (id: string, checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input.Group size="sm" className="min-w-0 flex-1 basis-60">
            <Input.Addon><Search /></Input.Addon>
            <Input
              aria-label="Apps durchsuchen"
              placeholder="Name, Beschreibung, Technologie …"
              value={filters.q}
              onChange={(event) => onFilterChange({ q: event.target.value })}
            />
          </Input.Group>
          <FilterSelect
            label="Status filtern"
            allLabel="Alle Status"
            options={statusOptions.map((status) => ({ value: status, label: getAppStatusMeta(status)?.label ?? status }))}
            value={filters.status}
            onChange={(value) => onFilterChange({ status: value })}
          />
          <FilterSelect
            label="Kategorie filtern"
            allLabel="Alle Kategorien"
            options={categoryOptions.map((category) => ({ value: category, label: category }))}
            value={filters.category}
            onChange={(value) => onFilterChange({ category: value })}
          />
          <FilterSelect
            label="Eigentümer filtern"
            allLabel="Alle Eigentümer"
            options={ownerOptions.map((owner) => ({ value: owner.id, label: authorName(owner) }))}
            value={filters.ownerId}
            onChange={(value) => onFilterChange({ ownerId: value })}
          />
          <Button
            size="sm"
            variant={moreFilters ? 'secondary' : 'ghost'}
            aria-expanded={moreFilters}
            onClick={() => setMoreFilters(!moreFilters)}
          >
            <SlidersHorizontal />
            Weitere Filter
            {hasAdvancedFilters && <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />}
          </Button>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={onResetFilters}>
              <RotateCcw />
              Zurücksetzen
            </Button>
          )}
        </div>
        {moreFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2">
            <FilterSelect
              label="Sichtbarkeit filtern"
              allLabel="Entwürfe und veröffentlichte"
              options={[{ value: 'draft', label: 'Nur Entwürfe' }, { value: 'published', label: 'Nur veröffentlichte' }]}
              value={filters.visibility}
              onChange={(value) => onFilterChange({ visibility: value })}
            />
            <FilterSelect
              label="Bearbeiter filtern"
              allLabel="Mit und ohne Bearbeiter"
              options={[{ value: 'true', label: 'Mit Bearbeitern' }, { value: 'false', label: 'Ohne Bearbeiter' }]}
              value={filters.hasEditors}
              onChange={(value) => onFilterChange({ hasEditors: value })}
            />
            <FilterSelect
              label="Repository-Sync filtern"
              allLabel="Jeder Sync-Zustand"
              options={SYNC_FILTER_OPTIONS}
              value={filters.syncStatus}
              onChange={(value) => onFilterChange({ syncStatus: value })}
            />
            <FilterSelect
              label="Empfohlene filtern"
              allLabel="Empfohlen und nicht"
              options={[{ value: 'true', label: 'Nur empfohlene' }, { value: 'false', label: 'Nicht empfohlene' }]}
              value={filters.featured}
              onChange={(value) => onFilterChange({ featured: value })}
            />
            <FilterSelect
              label="Sperre filtern"
              allLabel="Gesperrt und frei"
              options={[{ value: 'true', label: 'Nur gesperrte' }, { value: 'false', label: 'Nur freie' }]}
              value={filters.locked}
              onChange={(value) => onFilterChange({ locked: value })}
            />
          </div>
        )}
      </div>

      {selection.length > 0 && (
        <div role="toolbar" aria-label="Auswahl" className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
          <span className="me-auto text-sm font-medium">{selection.length} ausgewählt</span>
          {onBulkToggleLock && (
            <>
              <Button size="sm" variant="secondary" onClick={() => onBulkToggleLock(selection, true)}><Lock />Sperren</Button>
              <Button size="sm" variant="secondary" onClick={() => onBulkToggleLock(selection, false)}><Unlock />Freigeben</Button>
            </>
          )}
          {onBulkDelete && (
            <Button size="sm" variant="destructive" onClick={() => onBulkDelete(selection)}><Trash2 />Löschen</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}><X />Auswahl aufheben</Button>
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="Apps" framed>
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-10">
                <Checkbox
                  label="Alle Apps dieser Seite auswählen"
                  checked={rows.length > 0 && pageSelected === rows.length}
                  indeterminate={pageSelected > 0 && pageSelected < rows.length}
                  onCheckedChange={(checked) => togglePage(Boolean(checked))}
                  disabled={isLoading || rows.length === 0}
                />
              </Table.Head>
              <Table.Head>App</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head className="hidden 2xl:table-cell">Kategorien</Table.Head>
              <Table.Head>Repository</Table.Head>
              <Table.Head>Eigentümer</Table.Head>
              <Table.Head>Bearbeiter</Table.Head>
              <Table.Head align="end"><span className="sr-only">Aktionen</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              Array.from({ length: 6 }, (_, index) => <RowSkeleton key={index} />)
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={8} className="py-12 text-center text-muted-foreground">
                  {hasFilters ? 'Keine App passt zu diesen Filtern.' : 'Noch keine Apps im Katalog.'}
                </Table.Cell>
              </Table.Row>
            ) : (
              rows.map((app) => {
                const status = getAppStatusMeta(app.status);
                const sync = app.gitLabSync;
                const syncMeta = SYNC_STATUS[sync?.lastSyncStatus ?? ''] ?? { label: 'Unbekannt', variant: 'secondary' as BadgeVariant };
                const checked = selection.includes(app.id);
                return (
                  <Table.Row key={app.id} data-state={checked ? 'selected' : undefined}>
                    <Table.Cell>
                      <Checkbox label={`${app.name} auswählen`} checked={checked} onCheckedChange={(next) => toggleRow(app.id, Boolean(next))} />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex items-center gap-3">
                        <AppIcon app={app} />
                        <span className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => handleEditApp(app)}
                            className="w-fit cursor-pointer truncate text-start font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                          >
                            {app.name}
                          </button>
                          <span className="truncate font-mono text-xs text-muted-foreground">{app.id}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap items-center gap-1">
                        {status && <Badge variant={STATUS_BADGE_VARIANT[status.color] ?? 'secondary'} size="sm">{status.label}</Badge>}
                        {app.isFeatured && (
                          <Tooltip>
                            <Tooltip.Trigger render={<Badge variant="warning" size="sm" />}><Star />Empfohlen</Tooltip.Trigger>
                            <Tooltip.Content>Wird im Katalog oben gezeigt</Tooltip.Content>
                          </Tooltip>
                        )}
                        {app.isLocked && <Badge variant="outline" size="sm"><Lock />Gesperrt</Badge>}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="hidden 2xl:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {(app.categories ?? []).slice(0, 2).map((category) => <Badge key={category} variant="outline" size="sm">{category}</Badge>)}
                        {(app.categories?.length ?? 0) > 2 && (
                          <Tooltip>
                            <Tooltip.Trigger render={<Badge variant="outline" size="sm" />}>+{app.categories!.length - 2}</Tooltip.Trigger>
                            <Tooltip.Content>{app.categories!.slice(2).join(', ')}</Tooltip.Content>
                          </Tooltip>
                        )}
                        {!app.categories?.length && <span className="text-muted-foreground">–</span>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {sync?.linked ? (
                        <span className="flex flex-col gap-1">
                          <span className="flex flex-wrap gap-1">
                            <Badge variant={syncMeta.variant} size="sm">{syncMeta.label}</Badge>
                            {sync.approvalRequired && <Badge variant="warning" size="sm">Manuelle Änderungen</Badge>}
                          </span>
                          <span className="max-w-56 truncate text-xs text-muted-foreground" title={`${sync.providerKey} · ${sync.projectPath}`}>
                            {sync.projectPath}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground" title="Nicht mit einem Repository verknüpft">–</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {app.owner ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar user={app.owner} size="xs" />
                          <span className="max-w-32 truncate">{authorName(app.owner)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </Table.Cell>
                    <Table.Cell><Editors editors={app.editors} /></Table.Cell>
                    <Table.Cell align="end">
                      <span className="flex justify-end gap-0.5">
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${app.name} bearbeiten`} onClick={() => handleEditApp(app)} />}>
                            <Pencil />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Bearbeiten</Tooltip.Content>
                        </Tooltip>
                        <Menu>
                          <Menu.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`Weitere Aktionen für ${app.name}`} />}>
                            <MoreHorizontal />
                          </Menu.Trigger>
                          <Menu.Content align="end" className="min-w-52">
                            <Menu.Item render={<NextLink href={`/apps/${app.id}`} />}><ExternalLink />Im Katalog ansehen</Menu.Item>
                            {handleCopyApp && <Menu.Item onClick={() => handleCopyApp(app)}><Copy />Als Vorlage kopieren</Menu.Item>}
                            {handleManageEditors && <Menu.Item onClick={() => handleManageEditors(app)}><UsersRound />Bearbeiter verwalten</Menu.Item>}
                            {handleTransferApp && <Menu.Item onClick={() => handleTransferApp(app)}><UserRoundCog />Eigentümer übertragen</Menu.Item>}
                            <Menu.Item onClick={() => handleToggleAppLock(app)}>
                              {app.isLocked ? <Unlock /> : <Lock />}
                              {app.isLocked ? 'Sperre aufheben' : 'Sperren'}
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item variant="destructive" onClick={() => handleDeleteApp(app.id)}><Trash2 />Löschen</Menu.Item>
                          </Menu.Content>
                        </Menu>
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Card>

      {!isLoading && apps.length > ROWS_PER_PAGE && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, apps.length)} von {apps.length} Apps
          </p>
          <Pagination count={pageCount} page={page} onPageChange={(next) => setPaging({ key: filterKey, page: next })} />
        </div>
      )}
    </div>
  );
}
