'use client';

import { AppCatalogFilters, AppConfig, AppUserSummary } from '@/config/apps';
import { getAppStatusMeta } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import {
    Avatar,
    Button,
    Checkbox,
    Chip,
    Dropdown,
    EmptyState,
    Input,
  ListBox,
    Pagination,
  Select,
    type Selection,
    Table,
    Tooltip,
} from '@heroui/react';
import {
    Copy,
    ExternalLink,
  Filter,
    Info,
    Lock,
    MoreVertical,
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
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

const MAX_VISIBLE_EDITORS = 4;
const ALL_FILTER_VALUE = '__all__';

const SYNC_STATUS_OPTIONS = [
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

function FilterSelect({
  ariaLabel,
  options,
  value,
  widthClassName,
  onChange,
}: {
  ariaLabel: string;
  options: Array<{ value: string; label: string; description?: string }>;
  value: string;
  widthClassName?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      className={widthClassName}
      selectedKey={value || ALL_FILTER_VALUE}
      onSelectionChange={(key) => onChange(String(key) === ALL_FILTER_VALUE ? '' : String(key))}
    >
      <Select.Trigger className="bg-field-background border-border">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.value || ALL_FILTER_VALUE} id={option.value || ALL_FILTER_VALUE} textValue={option.label}>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">{option.label}</span>
                {option.description ? <span className="text-xs text-muted">{option.description}</span> : null}
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function getUserInitials(user: AppUserSummary) {
  const source = user.username.trim() || user.email.trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function UserAvatarTooltip({
  user,
  showName = false,
}: {
  user: AppUserSummary;
  showName?: boolean;
}) {
  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar size="sm" className="shrink-0 border-2 border-border shadow-sm">
            <Avatar.Fallback>{getUserInitials(user)}</Avatar.Fallback>
          </Avatar>
          {showName ? (
            <span className="truncate text-xs font-medium text-foreground">{user.username}</span>
          ) : null}
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground">{user.username}</span>
          <span className="text-[11px] text-muted">{user.email}</span>
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function EditorsAvatarGroup({ editors }: { editors?: AppUserSummary[] }) {
  if (!editors?.length) {
    return <span className="text-xs text-muted italic">Keine</span>;
  }

  const visibleEditors = editors.slice(0, MAX_VISIBLE_EDITORS);
  const overflowEditors = editors.slice(MAX_VISIBLE_EDITORS);

  return (
    <div className="flex items-center">
      <div className="flex items-center -space-x-2">
        {visibleEditors.map((editor) => (
          <Tooltip key={editor.id} delay={0}>
            <Tooltip.Trigger>
              <div>
                <Avatar size="sm" className="border-2 border-border bg-surface shadow-sm">
                  <Avatar.Fallback>{getUserInitials(editor)}</Avatar.Fallback>
                </Avatar>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">{editor.username}</span>
                <span className="text-[11px] text-muted">{editor.email}</span>
              </div>
            </Tooltip.Content>
          </Tooltip>
        ))}
        {overflowEditors.length > 0 ? (
          <Tooltip delay={0}>
            <Tooltip.Trigger>
              <div>
                <Avatar size="sm" className="border-2 border-border bg-accent/10 text-accent shadow-sm">
                  <Avatar.Fallback className="text-[10px] font-semibold">+{overflowEditors.length}</Avatar.Fallback>
                </Avatar>
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top">
              <div className="flex flex-col gap-1">
                {overflowEditors.map((editor) => (
                  <div key={editor.id} className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground">{editor.username}</span>
                    <span className="text-[11px] text-muted">{editor.email}</span>
                  </div>
                ))}
              </div>
            </Tooltip.Content>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface-secondary/40">
        <div className="h-4 w-4 bg-surface-secondary rounded" />
        {['w-48', 'w-28', 'w-24', 'w-36', 'w-16', 'w-28'].map((w, i) => (
          <div key={i} className={`h-3 ${w} bg-surface-secondary rounded`} />
        ))}
        <div className="ml-auto h-3 w-20 bg-surface-secondary rounded" />
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/60 last:border-0">
          <div className="h-4 w-4 bg-surface-secondary rounded" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-surface-secondary shrink-0" />
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-surface-secondary rounded" />
              <div className="h-3 w-20 bg-surface-secondary rounded" />
            </div>
          </div>
          <div className="w-28 flex gap-1">
            <div className="h-5 w-20 bg-surface-secondary rounded-full" />
          </div>
          <div className="w-24 h-5 bg-surface-secondary rounded-full" />
          <div className="w-32 space-y-1.5">
            <div className="h-3 w-full bg-surface-secondary rounded" />
            <div className="h-3 w-20 bg-surface-secondary rounded" />
          </div>
          <div className="w-12 h-5 bg-surface-secondary rounded-full" />
          <div className="w-28 space-y-1.5">
            <div className="h-3 w-full bg-surface-secondary rounded" />
            <div className="h-3 w-16 bg-surface-secondary rounded" />
          </div>
          <div className="flex gap-1 ml-auto">
            <div className="h-7 w-7 bg-surface-secondary rounded" />
            <div className="h-7 w-7 bg-surface-secondary rounded" />
            <div className="h-7 w-7 bg-surface-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

const getGitLabStatusMeta = (status?: string) => {
  switch (status) {
    case 'success':          return { label: 'Synchronisiert',           className: 'bg-success/10 text-success border border-success/20' };
    case 'warning':          return { label: 'Mit Hinweisen',             className: 'bg-warning/10 text-warning border border-warning/20' };
    case 'pending_approval': return { label: 'Wartet auf Freigabe',       className: 'bg-warning/10 text-warning border border-warning/20' };
    case 'error':            return { label: 'Fehler',                    className: 'bg-danger/10 text-danger border border-danger/20' };
    case 'never':            return { label: 'Noch nicht synchronisiert', className: 'bg-surface-secondary text-muted border border-border' };
    default:                 return { label: 'Unbekannt',                 className: 'bg-surface-secondary text-muted border border-border' };
  }
};

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
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const rowsPerPage = 10;

  const hasAdvancedFilters = Boolean(filters.hasEditors || filters.syncStatus || filters.featured || filters.locked || filters.visibility);
  const hasActiveFilters = Boolean(
    filters.q ||
    filters.status ||
    filters.category ||
    filters.ownerId ||
    filters.hasEditors ||
    filters.syncStatus ||
    filters.featured ||
    filters.locked ||
    filters.visibility
  );

  const totalPages = Math.ceil(apps.length / rowsPerPage);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  const appIdSet = useMemo(() => new Set(apps.map((app) => app.id)), [apps]);
  const selectedIdSet = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => appIdSet.has(id))),
    [appIdSet, selectedIds]
  );
  const selectedIdList = useMemo(() => Array.from(selectedIdSet), [selectedIdSet]);

  const items = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return apps.slice(start, start + rowsPerPage);
  }, [apps, currentPage]);
  const currentPageIds = useMemo(() => new Set(items.map((app) => app.id)), [items]);

  React.useEffect(() => {
    setPage(1);
  }, [filters.category, filters.featured, filters.hasEditors, filters.locked, filters.ownerId, filters.q, filters.status, filters.syncStatus, filters.visibility]);

  React.useEffect(() => {
    if (hasAdvancedFilters) {
      setShowAdvancedFilters(true);
    }
  }, [hasAdvancedFilters]);

  const handleSelectionChange = React.useCallback((keys: Selection) => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => appIdSet.has(id)));

      currentPageIds.forEach((id) => next.delete(id));

      if (keys === 'all') {
        currentPageIds.forEach((id) => next.add(id));
        return next;
      }

      Array.from(keys, (key) => String(key)).forEach((id) => next.add(id));
      return next;
    });
  }, [appIdSet, currentPageIds]);

  const topContent = (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-[24rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none z-10" />
          <Input
            className="w-full pl-9"
            placeholder="Nach App suchen..."
            value={filters.q}
            onChange={(e) => onFilterChange({ q: e.target.value })}
            variant="secondary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 xl:items-end">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:justify-end">
            <FilterSelect
              ariaLabel="Status filtern"
              options={[{ value: '', label: 'Alle Status' }, ...statusOptions.map((status) => ({ value: status, label: status }))]}
              value={filters.status}
              widthClassName="w-full sm:w-[11rem]"
              onChange={(value) => onFilterChange({ status: value })}
            />
            <FilterSelect
              ariaLabel="Kategorie filtern"
              options={[{ value: '', label: 'Alle Kategorien' }, ...categoryOptions.map((category) => ({ value: category, label: category }))]}
              value={filters.category}
              widthClassName="w-full sm:w-[12rem]"
              onChange={(value) => onFilterChange({ category: value })}
            />
            <FilterSelect
              ariaLabel="Besitzer filtern"
              options={[
                { value: '', label: 'Alle Besitzer' },
                ...ownerOptions.map((owner) => ({ value: owner.id, label: owner.username, description: owner.email })),
              ]}
              value={filters.ownerId}
              widthClassName="w-full sm:w-[13rem]"
              onChange={(value) => onFilterChange({ ownerId: value })}
            />
            <Button
              variant={showAdvancedFilters ? 'secondary' : 'ghost'}
              className="gap-2"
              onPress={() => setShowAdvancedFilters((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Weitere Filter
            </Button>
            {hasActiveFilters ? (
              <Button variant="ghost" className="gap-2 text-muted" onPress={onResetFilters}>
                <RotateCcw className="h-4 w-4" /> Filter zurücksetzen
              </Button>
            ) : null}
          </div>
          {showAdvancedFilters ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-secondary/30 p-3 sm:flex-row sm:flex-wrap xl:justify-end">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <Filter className="h-3.5 w-3.5" /> Weitere Filter
              </div>
              <FilterSelect
                ariaLabel="Bearbeiter filtern"
                options={[
                  { value: '', label: 'Bearbeiter: alle' },
                  { value: 'true', label: 'Mit Bearbeitern' },
                  { value: 'false', label: 'Ohne Bearbeiter' },
                ]}
                value={filters.hasEditors}
                widthClassName="w-full sm:w-[11rem]"
                onChange={(value) => onFilterChange({ hasEditors: value })}
              />
              <FilterSelect
                ariaLabel="Repository Sync filtern"
                options={[{ value: '', label: 'Repository Sync: alle' }, ...SYNC_STATUS_OPTIONS]}
                value={filters.syncStatus}
                widthClassName="w-full sm:w-[14rem]"
                onChange={(value) => onFilterChange({ syncStatus: value })}
              />
              <FilterSelect
                ariaLabel="Featured filtern"
                options={[
                  { value: '', label: 'Top: alle' },
                  { value: 'true', label: 'Nur Top' },
                  { value: 'false', label: 'Nicht Top' },
                ]}
                value={filters.featured}
                widthClassName="w-full sm:w-[10rem]"
                onChange={(value) => onFilterChange({ featured: value })}
              />
              <FilterSelect
                ariaLabel="Sperrstatus filtern"
                options={[
                  { value: '', label: 'Sperrung: alle' },
                  { value: 'true', label: 'Gesperrt' },
                  { value: 'false', label: 'Nicht gesperrt' },
                ]}
                value={filters.locked}
                widthClassName="w-full sm:w-[11rem]"
                onChange={(value) => onFilterChange({ locked: value })}
              />
              <FilterSelect
                ariaLabel="Sichtbarkeit filtern"
                options={[
                  { value: '', label: 'Sichtbarkeit: alle' },
                  { value: 'draft', label: 'Nur Entwürfe' },
                  { value: 'published', label: 'Nur veröffentlichte Apps' },
                ]}
                value={filters.visibility}
                widthClassName="w-full sm:w-[13rem]"
                onChange={(value) => onFilterChange({ visibility: value })}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIdList.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20">
          <span className="text-sm font-semibold text-accent">
            {selectedIdList.length} ausgewählt
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {onBulkToggleLock && (
              <>
                <Button
                  size="sm" variant="secondary"
                  className="gap-1.5 text-xs"
                  onPress={() => onBulkToggleLock(selectedIdList, true)}
                >
                  <Lock className="w-3.5 h-3.5" /> Sperren
                </Button>
                <Button
                  size="sm" variant="secondary"
                  className="gap-1.5 text-xs"
                  onPress={() => onBulkToggleLock(selectedIdList, false)}
                >
                  <Unlock className="w-3.5 h-3.5" /> Freigeben
                </Button>
              </>
            )}
            {onBulkDelete && (
              <Button
                size="sm" variant="danger-soft"
                className="gap-1.5 text-xs"
                onPress={() => onBulkDelete(selectedIdList)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Löschen ({selectedIdList.length})
              </Button>
            )}
            <Button
              size="sm" variant="ghost"
              className="gap-1.5 text-xs text-muted"
              onPress={() => setSelectedIds(new Set())}
            >
              <X className="w-3.5 h-3.5" /> Auswahl aufheben
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const bottomContent = useMemo(() => {
    if (totalPages <= 1) return null;
    const start = (currentPage - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage * rowsPerPage, apps.length);
    return (
      <div className="py-2 px-2 flex justify-between items-center mt-4">
        <Pagination size="sm">
          <Pagination.Summary>{start} bis {end} von {apps.length} Apps</Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous isDisabled={currentPage === 1} onPress={() => setPage(p => Math.max(1, p - 1))}>
                <Pagination.PreviousIcon /> Zurück
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === currentPage} onPress={() => setPage(p)}>{p}</Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={currentPage === totalPages} onPress={() => setPage(p => Math.min(totalPages, p + 1))}>
                Weiter <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    );
  }, [apps.length, currentPage, totalPages]);

  if (isLoading) {
    return (
      <div className="w-full">
        {topContent}
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {topContent}
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Tabelle der Apps"
            className="min-w-[1320px] xl:min-w-0"
            selectedKeys={selectedIdSet}
            selectionMode="multiple"
            onSelectionChange={handleSelectionChange}
          >
            <Table.Header>
              <Table.Column className="w-10 pr-0">
                <Checkbox aria-label="Alle auf dieser Seite auswählen" slot="selection">
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                </Checkbox>
              </Table.Column>
              <Table.Column isRowHeader>App</Table.Column>
              <Table.Column>Kategorien</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Repository Sync</Table.Column>
              <Table.Column>Lösung</Table.Column>
              <Table.Column>Besitzer</Table.Column>
              <Table.Column>Bearbeiter</Table.Column>
              <Table.Column className="text-right">Aktionen</Table.Column>
            </Table.Header>
            <Table.Body
              items={items}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-10 gap-2">
                  <Info className="w-8 h-8 text-muted opacity-50" />
                  <span className="text-muted">Keine Apps gefunden</span>
                </EmptyState>
              )}
            >
              {(app) => (
                <Table.Row key={app.id} id={app.id}>
                  {/* Checkbox */}
                  <Table.Cell className="pr-0">
                    <Checkbox aria-label={`${app.name} auswählen`} slot="selection" variant="secondary">
                      <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                    </Checkbox>
                  </Table.Cell>

                  {/* App */}
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-xl overflow-hidden shadow-sm">
                        {(() => {
                          const iconSrc = getImageAssetUrl(app.icon);

                          return iconSrc ? (
                            <Image src={iconSrc} alt={app.name} fill className="object-contain p-1.5" sizes="40px" unoptimized />
                          ) : (
                            app.icon || '🏛️'
                          );
                        })()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{app.name}</span>
                        <span className="text-[10px] font-mono text-muted">{app.id}</span>
                      </div>
                    </div>
                  </Table.Cell>

                  {/* Categories */}
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {app.categories?.slice(0, 2).map(cat => (
                        <Chip key={cat} size="sm" variant="soft" className="font-bold text-[9px] uppercase tracking-wider">{cat}</Chip>
                      ))}
                      {(app.categories?.length || 0) > 2 && (
                        <Chip size="sm" variant="soft" className="font-bold text-[9px] uppercase tracking-wider">+{app.categories!.length - 2}</Chip>
                      )}
                    </div>
                  </Table.Cell>

                  {/* Status */}
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {app.status && (() => {
                        const meta = getAppStatusMeta(app.status);
                        return (
                          <Chip
                            size="sm"
                            color={meta?.color as 'default' | 'success' | 'warning' | 'accent'}
                            variant="soft"
                            className="font-bold text-[10px] uppercase tracking-wider"
                          >
                            {meta?.label || app.status}
                          </Chip>
                        );
                      })()}
                      {app.isLocked && (
                        <Chip size="sm" variant="soft" color="warning" className="font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Gesperrt
                        </Chip>
                      )}
                    </div>
                  </Table.Cell>

                  {/* Repository Sync */}
                  <Table.Cell>
                    {app.gitLabSync?.linked ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Chip size="sm" variant="soft" className={`font-bold text-[9px] uppercase tracking-wider ${getGitLabStatusMeta(app.gitLabSync.lastSyncStatus).className}`}>
                            {getGitLabStatusMeta(app.gitLabSync.lastSyncStatus).label}
                          </Chip>
                          {app.gitLabSync.approvalRequired && (
                            <Chip size="sm" variant="soft" className="bg-warning/10 text-warning border border-warning/20 font-bold text-[9px] uppercase tracking-wider">
                              Manuelle Änderungen
                            </Chip>
                          )}
                        </div>
                        <div className="flex flex-col text-[10px] text-muted">
                          <span>{app.gitLabSync.providerKey} · {app.gitLabSync.projectPath}</span>
                          <span>
                            {app.gitLabSync.lastSyncedAt
                              ? `Zuletzt: ${new Date(app.gitLabSync.lastSyncedAt).toLocaleString('de-DE')}`
                              : 'Noch kein erfolgreicher Lauf'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">Nicht verknüpft</span>
                    )}
                  </Table.Cell>

                  {/* Featured */}
                  <Table.Cell>
                    {app.isFeatured && (
                      <Chip size="sm" variant="soft" className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-[9px] uppercase tracking-wider gap-1 pl-1">
                        <Star className="w-2.5 h-2.5 fill-amber-500" /> Top
                      </Chip>
                    )}
                  </Table.Cell>

                  {/* Owner */}
                  <Table.Cell>
                    {app.owner ? (
                      <UserAvatarTooltip user={app.owner} showName />
                    ) : (
                      <span className="text-xs text-muted italic">System</span>
                    )}
                  </Table.Cell>

                  {/* Editors */}
                  <Table.Cell>
                    <EditorsAvatarGroup editors={app.editors} />
                  </Table.Cell>

                  {/* Actions */}
                  <Table.Cell>
                    <div className="flex items-center justify-end gap-1">
                      <Button isIconOnly size="sm" variant="tertiary" onPress={() => router.push(`/apps/${app.id}`)} aria-label="Ansehen">
                        <ExternalLink className="w-4 h-4 text-muted" />
                      </Button>
                      <Button isIconOnly size="sm" variant="tertiary" onPress={() => handleEditApp(app)} aria-label="Bearbeiten">
                        <Pencil className="w-4 h-4 text-muted" />
                      </Button>
                      <Dropdown>
                        <Button isIconOnly size="sm" variant="tertiary" aria-label="Aktionen">
                          <MoreVertical className="w-4 h-4 text-muted" />
                        </Button>
                        <Dropdown.Popover>
                          <Dropdown.Menu onAction={(key) => {
                            if (key === 'copy' && handleCopyApp) handleCopyApp(app);
                            if (key === 'lock') handleToggleAppLock(app);
                            if (key === 'editors' && handleManageEditors) handleManageEditors(app);
                            if (key === 'transfer' && handleTransferApp) handleTransferApp(app);
                            if (key === 'delete') handleDeleteApp(app.id);
                          }}>
                            {handleCopyApp && (
                              <Dropdown.Item id="copy" textValue="Kopieren">
                                <div className="flex items-center gap-2">
                                  <Copy className="w-4 h-4" /> Kopieren
                                </div>
                              </Dropdown.Item>
                            )}
                            <Dropdown.Item id="lock" textValue={app.isLocked ? 'Freigeben' : 'Sperren'} className={app.isLocked ? 'text-success' : 'text-warning'}>
                              <div className="flex items-center gap-2">
                                {app.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                {app.isLocked ? 'Freigeben' : 'Sperren'}
                              </div>
                            </Dropdown.Item>
                            {handleManageEditors && (
                              <Dropdown.Item id="editors" textValue="Bearbeiter verwalten">
                                <div className="flex items-center gap-2">
                                  <UsersRound className="w-4 h-4" /> Bearbeiter verwalten
                                </div>
                              </Dropdown.Item>
                            )}
                            {handleTransferApp && (
                              <Dropdown.Item id="transfer" textValue="Besitzer übertragen">
                                <div className="flex items-center gap-2">
                                  <UserRoundCog className="w-4 h-4" /> Besitzer übertragen
                                </div>
                              </Dropdown.Item>
                            )}
                            <Dropdown.Item id="delete" textValue="Löschen" className="text-danger">
                              <div className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> Löschen
                              </div>
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {bottomContent}
    </div>
  );
}
