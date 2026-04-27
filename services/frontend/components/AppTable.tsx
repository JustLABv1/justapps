'use client';

import { AppConfig } from '@/config/apps';
import { getAppStatusMeta } from '@/lib/appStatus';
import { getImageAssetUrl } from '@/lib/assets';
import {
    Button,
    Checkbox,
    Chip,
    Dropdown,
    EmptyState,
    Input,
    Pagination,
    type Selection,
    Table
} from '@heroui/react';
import {
    Copy,
    ExternalLink,
    Info,
    Lock,
    MoreVertical,
    Pencil,
    Search,
    Star,
    Trash2,
    Unlock,
    UserRoundCog,
    X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

interface AppTableProps {
  apps: AppConfig[];
  isLoading?: boolean;
  handleEditApp: (app: AppConfig) => void;
  handleDeleteApp: (id: string) => void;
  handleToggleAppLock: (app: AppConfig) => void;
  handleCopyApp?: (app: AppConfig) => void;
  handleTransferApp?: (app: AppConfig) => void;
  onBulkDelete?: (ids: string[]) => void;
  onBulkToggleLock?: (ids: string[], lock: boolean) => void;
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
  isLoading,
  handleEditApp,
  handleDeleteApp,
  handleToggleAppLock,
  handleCopyApp,
  handleTransferApp,
  onBulkDelete,
  onBulkToggleLock,
}: AppTableProps) {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const rowsPerPage = 10;

  const filteredItems = useMemo(() => {
    if (!filterValue) return [...apps];
    return apps.filter((app) =>
      app.name.toLowerCase().includes(filterValue.toLowerCase()) ||
      app.id.toLowerCase().includes(filterValue.toLowerCase()) ||
      app.owner?.username?.toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [apps, filterValue]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  const appIdSet = useMemo(() => new Set(apps.map((app) => app.id)), [apps]);
  const selectedIdSet = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => appIdSet.has(id))),
    [appIdSet, selectedIds]
  );
  const selectedIdList = useMemo(() => Array.from(selectedIdSet), [selectedIdSet]);

  const items = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [currentPage, filteredItems]);
  const currentPageIds = useMemo(() => new Set(items.map((app) => app.id)), [items]);

  const onSearchChange = React.useCallback((value: string) => {
    setFilterValue(value);
    setPage(1);
  }, []);

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
      <div className="flex justify-between gap-3 items-center">
        <div className="relative w-full sm:max-w-[32rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none z-10" />
          <Input
            className="w-full pl-9"
            placeholder="Nach App suchen..."
            value={filterValue}
            onChange={(e) => onSearchChange(e.target.value)}
            variant="secondary"
          />
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
    const end = Math.min(currentPage * rowsPerPage, filteredItems.length);
    return (
      <div className="py-2 px-2 flex justify-between items-center mt-4">
        <Pagination size="sm">
          <Pagination.Summary>{start} bis {end} von {filteredItems.length} Apps</Pagination.Summary>
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
  }, [currentPage, totalPages, filteredItems.length]);

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
            className="min-w-[1180px] xl:min-w-0"
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
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">{app.owner.username}</span>
                        <span className="text-[10px] text-muted">{app.owner.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">System</span>
                    )}
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
