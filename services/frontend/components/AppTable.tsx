'use client';

import { AppConfig } from '@/config/apps';
import {
    Button,
    Chip,
    Dropdown,
    EmptyState,
    Input,
    Pagination,
    Table
} from '@heroui/react';
import {
    ExternalLink,
    Info,
    Lock,
    MoreVertical,
    Pencil,
    Search,
    Star,
    Trash2,
    Unlock,
    UserRoundCog
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';

interface AppTableProps {
  apps: AppConfig[];
  handleEditApp: (app: AppConfig) => void;
  handleDeleteApp: (id: string) => void;
  handleToggleAppLock: (app: AppConfig) => void;
  handleTransferApp?: (app: AppConfig) => void;
}

export function AppTable({ apps, handleEditApp, handleDeleteApp, handleToggleAppLock, handleTransferApp }: AppTableProps) {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const hasSearchFilter = Boolean(filterValue);

  const filteredItems = useMemo(() => {
    let filteredApps = [...apps];

    if (hasSearchFilter) {
      filteredApps = filteredApps.filter((app) =>
        app.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        app.id.toLowerCase().includes(filterValue.toLowerCase()) ||
        app.owner?.username?.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredApps;
  }, [apps, filterValue, hasSearchFilter]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return null;
    const s = status.toUpperCase();
    const labels: Record<string, string> = {
      'POC': 'POC',
      'MVP': 'MVP',
      'SANDBOX': 'Sandbox',
      'IN ERPROBUNG': 'In Erprobung',
      'ETABLIERT': 'Etabliert',
      'INCUBATING': 'In Erprobung',
      'GRADUATED': 'Etabliert',
      'TEST': 'Test'
    };
    return labels[s] || status;
  };

  const onSearchChange = React.useCallback((value: string) => {
    setFilterValue(value);
    setPage(1);
  }, []);

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between gap-3 items-center">
          <div className="relative w-full sm:max-w-[44%]">
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
      </div>
    );
  }, [filterValue, onSearchChange]);

  const bottomContent = useMemo(() => {
    if (totalPages <= 1) return null;
    
    const start = (page - 1) * rowsPerPage + 1;
    const end = Math.min(page * rowsPerPage, filteredItems.length);

    return (
      <div className="py-2 px-2 flex justify-between items-center mt-4">
        <Pagination size="sm">
          <Pagination.Summary>
            {start} bis {end} von {filteredItems.length} Apps
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Pagination.PreviousIcon />
                Zurück
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={page === totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Weiter
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    );
  }, [page, totalPages, filteredItems.length, rowsPerPage]);

  return (
    <div className="w-full">
      {topContent}
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Apps Management Table" className="min-w-[800px]">
            <Table.Header>
              <Table.Column isRowHeader>App</Table.Column>
              <Table.Column>Kategorien</Table.Column>
              <Table.Column>Status</Table.Column>
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
                <Table.Row key={app.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-xl overflow-hidden shadow-sm">
                        {app.icon?.startsWith('http') ? (
                          <Image 
                            src={app.icon} 
                            alt={app.name} 
                            fill 
                              className="object-contain p-1.5" 
                            sizes="40px" 
                            unoptimized
                          />
                        ) : (
                          app.icon || "🏛️"
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{app.name}</span>
                        <span className="text-[10px] font-mono text-muted">{app.id}</span>
                      </div>
                    </div>
                  </Table.Cell>
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
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {app.status && (
                        <div className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 uppercase tracking-wider">
                          {getStatusLabel(app.status)}
                        </div>
                      )}
                      {app.isLocked && (
                        <Chip size="sm" variant="soft" color="warning" className="font-bold text-[9px] uppercase tracking-wider bg-warning/10 text-warning flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Gesperrt
                        </Chip>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {app.isFeatured && (
                      <Chip 
                        size="sm" 
                        variant="soft" 
                        className="bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-[9px] uppercase tracking-wider gap-1 pl-1"
                      >
                        <Star className="w-2.5 h-2.5 fill-amber-500" /> Top
                      </Chip>
                    )}
                  </Table.Cell>
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
                            if (key === 'lock') handleToggleAppLock(app);
                            if (key === 'transfer' && handleTransferApp) handleTransferApp(app);
                            if (key === 'delete') handleDeleteApp(app.id);
                          }}>
                            <Dropdown.Item id="lock" textValue={app.isLocked ? 'Freigeben' : 'Sperren'} className={app.isLocked ? "text-success" : "text-warning"}>
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
