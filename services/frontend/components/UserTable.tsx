'use client';

import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Input } from '@/components/panelui/input';
import { Menu } from '@/components/panelui/menu';
import { Pagination } from '@/components/panelui/pagination';
import { Select } from '@/components/panelui/select';
import { Table } from '@/components/panelui/table';
import { Tooltip } from '@/components/panelui/tooltip';
import { UserAvatar, authorName } from '@/components/profile/UserAvatar';
import { Ban, CircleCheck, FolderPlus, Lock, MoreHorizontal, Pencil, Search, Trash2, Unlock } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  disabled: boolean;
  canSubmitApps?: boolean;
  canCreateSpaces?: boolean;
  disabledReason?: string;
  created_at?: string;
  createdAt?: string;
  authType?: string;
  lastLoginAt?: string | null;
}

interface UserTableProps {
  users: AdminUser[];
  currentUserId?: string;
  isLoading?: boolean;
  handleEditUser: (user: AdminUser) => void;
  handleDeleteUser: (userId: string) => void;
  handleToggleUserState: (user: AdminUser) => void | Promise<void>;
  handleToggleUserSubmission: (user: AdminUser) => void | Promise<void>;
  handleToggleUserSpaces?: (user: AdminUser) => void | Promise<void>;
  roleLabels?: Record<string, string>;
}

const ROWS_PER_PAGE = 15;
const ALL = '__all__';
const STATUS_FILTERS = [
  { value: ALL, label: 'Alle Konten' },
  { value: 'active', label: 'Aktiv' },
  { value: 'disabled', label: 'Deaktiviert' },
  { value: 'no-apps', label: 'App-Erstellung gesperrt' },
];

const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
function timeAgo(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'gerade eben';
}
const shortDate = (value: string) => new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

export function UserTable({
  users,
  currentUserId,
  isLoading,
  handleEditUser,
  handleDeleteUser,
  handleToggleUserState,
  handleToggleUserSubmission,
  handleToggleUserSpaces,
  roleLabels = {},
}: UserTableProps) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

  const roleLabel = (key: string) => roleLabels[key]
    || ({ admin: 'Administration', moderator: 'Moderation', user: 'Mitglied' } as Record<string, string>)[key]
    || key.replaceAll('-', ' ');
  const roleItems = [{ value: ALL, label: 'Alle Rollen' }, ...Array.from(new Set(users.map((user) => user.role))).map((key) => ({ value: key, label: roleLabel(key) }))];

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de');
    return users.filter((user) => {
      if (query && ![user.username, user.email, user.displayName ?? '', user.id].some((value) => value.toLocaleLowerCase('de').includes(query))) return false;
      if (role !== ALL && user.role !== role) return false;
      if (status === 'active' && user.disabled) return false;
      if (status === 'disabled' && !user.disabled) return false;
      if (status === 'no-apps' && user.canSubmitApps !== false) return false;
      return true;
    });
  }, [role, search, status, users]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * ROWS_PER_PAGE, current * ROWS_PER_PAGE);
  const resetPage = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input.Group size="sm" className="min-w-0 flex-1 basis-60">
          <Input.Addon><Search /></Input.Addon>
          <Input aria-label="Benutzer durchsuchen" placeholder="Name oder E-Mail" value={search} onChange={(event) => resetPage(setSearch)(event.target.value)} />
        </Input.Group>
        <Select items={roleItems} value={role} onValueChange={(value) => resetPage(setRole)(String(value ?? ALL))}>
          <Select.Trigger size="sm" aria-label="Rolle filtern" className="w-full sm:w-44"><Select.Value /></Select.Trigger>
          <Select.Content>{roleItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
        </Select>
        <Select items={STATUS_FILTERS} value={status} onValueChange={(value) => resetPage(setStatus)(String(value ?? ALL))}>
          <Select.Trigger size="sm" aria-label="Status filtern" className="w-full sm:w-52"><Select.Value /></Select.Trigger>
          <Select.Content>{STATUS_FILTERS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
        </Select>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table aria-label="Benutzer" framed>
          <Table.Header>
            <Table.Row>
              <Table.Head>Benutzer</Table.Head>
              <Table.Head>Rolle</Table.Head>
              <Table.Head>Freigaben</Table.Head>
              <Table.Head>Zuletzt angemeldet</Table.Head>
              <Table.Head className="hidden xl:table-cell">Dabei seit</Table.Head>
              <Table.Head align="end"><span className="sr-only">Aktionen</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              Array.from({ length: 5 }, (_, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    <span className="flex items-center gap-3">
                      <span className="size-8 animate-pulse rounded-full bg-muted" />
                      <span className="flex flex-col gap-1.5">
                        <span className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        <span className="h-3 w-44 animate-pulse rounded bg-muted" />
                      </span>
                    </span>
                  </Table.Cell>
                  {[0, 1, 2, 3, 4].map((cell) => <Table.Cell key={cell}><span className="block h-4 w-16 animate-pulse rounded bg-muted" /></Table.Cell>)}
                </Table.Row>
              ))
            ) : rows.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="py-12 text-center text-muted-foreground">Niemand passt zu dieser Suche.</Table.Cell>
              </Table.Row>
            ) : (
              rows.map((user) => {
                const self = user.id === currentUserId;
                const created = user.created_at ?? user.createdAt;
                const admin = user.role === 'admin';
                return (
                  <Table.Row key={user.id} className={user.disabled ? 'text-muted-foreground' : undefined}>
                    <Table.Cell>
                      <span className="flex items-center gap-3">
                        <UserAvatar user={user} size="sm" className={user.disabled ? 'opacity-50' : undefined} />
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditUser(user)}
                              className="cursor-pointer truncate text-start font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                            >
                              {authorName(user)}
                            </button>
                            {self && <Badge variant="outline" size="sm">Du</Badge>}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col items-start gap-1">
                        <Badge variant={admin ? 'info' : user.role === 'moderator' ? 'warning' : 'secondary'} size="sm">{roleLabel(user.role)}</Badge>
                        <span className="text-xs text-muted-foreground">{user.authType === 'oidc' ? 'Single Sign-on' : 'Lokales Konto'}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-wrap gap-1">
                        {user.disabled ? (
                          <Tooltip>
                            <Tooltip.Trigger render={<Badge variant="destructive" size="sm" />}><Ban />Deaktiviert</Tooltip.Trigger>
                            <Tooltip.Content>{user.disabledReason || 'Kann sich nicht mehr anmelden'}</Tooltip.Content>
                          </Tooltip>
                        ) : (
                          <>
                            <Badge variant={user.canSubmitApps === false ? 'warning' : 'success'} size="sm">
                              {user.canSubmitApps === false ? <Lock /> : <CircleCheck />}
                              Apps
                            </Badge>
                            <Badge variant={admin || user.canCreateSpaces ? 'success' : 'secondary'} size="sm">
                              {admin || user.canCreateSpaces ? <CircleCheck /> : <Lock />}
                              Spaces
                            </Badge>
                          </>
                        )}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      {user.lastLoginAt
                        ? <time dateTime={user.lastLoginAt} title={new Date(user.lastLoginAt).toLocaleString('de-DE')} className="whitespace-nowrap">{timeAgo(user.lastLoginAt)}</time>
                        : <span className="text-muted-foreground">Noch nie</span>}
                    </Table.Cell>
                    <Table.Cell className="hidden whitespace-nowrap text-muted-foreground xl:table-cell">
                      {created ? shortDate(created) : '–'}
                    </Table.Cell>
                    <Table.Cell align="end">
                      <span className="flex justify-end gap-0.5">
                        <Tooltip>
                          <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${authorName(user)} bearbeiten`} onClick={() => handleEditUser(user)} />}>
                            <Pencil />
                          </Tooltip.Trigger>
                          <Tooltip.Content>Bearbeiten</Tooltip.Content>
                        </Tooltip>
                        <Menu>
                          <Menu.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`Weitere Aktionen für ${authorName(user)}`} />}>
                            <MoreHorizontal />
                          </Menu.Trigger>
                          <Menu.Content align="end" className="min-w-56">
                            <Menu.Item onClick={() => void handleToggleUserSubmission(user)}>
                              {user.canSubmitApps === false ? <Unlock /> : <Lock />}
                              {user.canSubmitApps === false ? 'App-Erstellung erlauben' : 'App-Erstellung sperren'}
                            </Menu.Item>
                            {handleToggleUserSpaces && !admin && (
                              <Menu.Item onClick={() => void handleToggleUserSpaces(user)}>
                                <FolderPlus />
                                {user.canCreateSpaces ? 'Space-Erstellung sperren' : 'Space-Erstellung erlauben'}
                              </Menu.Item>
                            )}
                            {!self && (
                              <>
                                <Menu.Separator />
                                <Menu.Item onClick={() => void handleToggleUserState(user)}>
                                  {user.disabled ? <Unlock /> : <Ban />}
                                  {user.disabled ? 'Konto aktivieren' : 'Konto deaktivieren'}
                                </Menu.Item>
                                <Menu.Item variant="destructive" onClick={() => handleDeleteUser(user.id)}>
                                  <Trash2 />
                                  Löschen
                                </Menu.Item>
                              </>
                            )}
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

      {!isLoading && filtered.length > ROWS_PER_PAGE && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {(current - 1) * ROWS_PER_PAGE + 1}–{Math.min(current * ROWS_PER_PAGE, filtered.length)} von {filtered.length}
          </p>
          <Pagination count={pageCount} page={current} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
