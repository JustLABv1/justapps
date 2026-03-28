'use client';

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
    Info,
    Lock,
    MoreVertical,
    Pencil,
    Search,
    ShieldCheck,
    Trash2,
    Unlock,
    User
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
  canSubmitApps?: boolean;
  disabledReason?: string;
  createdAt?: string;
  authType?: string;
  lastLoginAt?: string;
}

interface UserTableProps {
  users: SystemUser[];
  handleEditUser: (u: SystemUser) => void;
  handleDeleteUser: (userId: string) => void;
  handleToggleUserState: (u: SystemUser) => void | Promise<void>;
  handleToggleUserSubmission: (u: SystemUser) => void | Promise<void>;
}

export function UserTable({
  users,
  handleEditUser,
  handleDeleteUser,
  handleToggleUserState,
  handleToggleUserSubmission
}: UserTableProps) {
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const hasSearchFilter = Boolean(filterValue);

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];

    if (hasSearchFilter) {
      filteredUsers = filteredUsers.filter((u) =>
        u.username.toLowerCase().includes(filterValue.toLowerCase()) ||
        u.email.toLowerCase().includes(filterValue.toLowerCase()) ||
        u.id.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [users, filterValue, hasSearchFilter]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredItems.slice(start, end);
  }, [page, filteredItems, rowsPerPage]);

  const onSearchChange = React.useCallback((value: string) => {
    setPage(1);
    setFilterValue(value);
  }, []);

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex justify-between gap-3 items-center">
          <div className="relative w-full sm:max-w-[44%]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none z-10" />
            <Input
              className="w-full pl-9"
              placeholder="Nach Benutzer suchen..."
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
            {start} bis {end} von {filteredItems.length} Benutzern
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
          <Table.Content aria-label="Tabelle der Benutzer" className="min-w-[1000px]">
            <Table.Header>
              <Table.Column isRowHeader>Benutzer</Table.Column>
              <Table.Column>Rolle</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Erstellt</Table.Column>
              <Table.Column>Letzter Login</Table.Column>
              <Table.Column className="text-right">Aktionen</Table.Column>
            </Table.Header>
            <Table.Body 
              items={items}
              renderEmptyState={() => (
                <EmptyState className="flex flex-col items-center justify-center py-10 gap-2">
                  <Info className="w-8 h-8 text-muted opacity-50" />
                  <span className="text-muted">Keine Benutzer gefunden</span>
                </EmptyState>
              )}
            >
              {(u) => (
                <Table.Row key={u.id} className={u.disabled ? 'opacity-75' : ''}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm flex-shrink-0 border ${u.role === 'admin' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-surface-secondary border-border text-muted'}`}>
                        {u.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{u.username}</span>
                        <span className="text-[10px] text-muted">{u.email}</span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                    <Chip size="sm" variant="soft" className={`font-bold text-[9px] uppercase tracking-wider ${u.role === 'admin' ? 'bg-accent/10 text-accent' : ''}`}>{u.role === 'admin' ? 'Administrator' : 'Benutzer'}</Chip>
                    {u.authType && (
                      <Chip size="sm" variant="primary" className="font-bold text-[9px] uppercase tracking-wider opacity-70 border-border/50">
                        {u.authType === 'oidc' ? 'OIDC' : 'Lokal'}
                      </Chip>
                    )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      {u.canSubmitApps === false && (
                        <Chip size="sm" variant="soft" color="warning" className="font-bold text-[9px] uppercase tracking-wider bg-warning/10 text-warning">App-Erstellung gesperrt</Chip>
                      )}
                      {u.disabled && (
                        <Chip size="sm" variant="soft" className="font-bold text-[9px] uppercase tracking-wider bg-danger/10 text-danger text-danger">Deaktiviert</Chip>
                      )}
                      {!u.disabled && u.canSubmitApps !== false && (
                        <Chip size="sm" variant="soft" className="font-bold text-[9px] uppercase tracking-wider bg-success/10 text-success text-success">Aktiv</Chip>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-default-500">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-default-500">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'Nie'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center justify-end gap-1">
                      <Button isIconOnly size="sm" variant="tertiary" onPress={() => handleEditUser(u)} aria-label="Bearbeiten">
                        <Pencil className="w-4 h-4 text-muted" />
                      </Button>
                      <Dropdown>
                        <Button isIconOnly size="sm" variant="tertiary" aria-label="Benutzeraktionen">
                          <MoreVertical className="w-4 h-4 text-muted" />
                        </Button>
                        <Dropdown.Popover>
                        <Dropdown.Menu onAction={(key) => {
                            if (key === 'state') handleToggleUserState(u);
                            if (key === 'submission') handleToggleUserSubmission(u);
                            if (key === 'edit') handleEditUser(u);
                            if (key === 'delete') handleDeleteUser(u.id);
                          }}>
                            <Dropdown.Item id="state" textValue={u.disabled ? 'Konto aktivieren' : 'Konto sperren'}>
                              <div className={`flex items-center gap-2 ${u.disabled ? 'text-success' : 'text-danger'}`}>
                                {u.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                {u.disabled ? 'Konto aktivieren' : 'Konto sperren'}
                              </div>
                            </Dropdown.Item>
                            <Dropdown.Item id="submission" textValue={u.canSubmitApps === false ? 'Einreichung erlauben' : 'Einreichung sperren'}>
                              <div className={`flex items-center gap-2 ${u.canSubmitApps === false ? 'text-success' : 'text-danger'}`}>
                                {u.canSubmitApps === false ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                {u.canSubmitApps === false ? 'Einreichung erlauben' : 'Einreichung sperren'}
                              </div>
                            </Dropdown.Item>
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
