'use client';

import {
  Button,
  Card,
  Chip,
  Dropdown,
} from '@heroui/react';
import {
  Lock,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Trash2,
  Unlock,
  User,
} from 'lucide-react';

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
}

interface UserListProps {
  users: SystemUser[];
  handleEditUser: (u: SystemUser) => void;
  handleDeleteUser: (userId: string) => void;
  handleToggleUserState: (u: SystemUser) => void | Promise<void>;
  handleToggleUserSubmission: (u: SystemUser) => void | Promise<void>;
}

export function UserList({
  users,
  handleEditUser,
  handleDeleteUser,
  handleToggleUserState,
  handleToggleUserSubmission
}: UserListProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {users.map((u) => (
        <Card key={u.id} variant="default" className={`hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group ${u.disabled ? 'opacity-75' : ''}`}>
          <div className="flex flex-col md:flex-row items-center p-5 gap-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-sm flex-shrink-0 border ${u.role === 'admin' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-surface-secondary border-border text-muted'}`}>
              {u.role === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
            </div>
            <div className="flex-grow text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-1.5 flex-wrap">
                <h3 className="text-lg font-bold text-foreground">{u.username}</h3>
                <Chip size="sm" variant="soft" className={`font-bold text-[10px] uppercase tracking-wider ${u.role === 'admin' ? 'bg-accent/10 text-accent' : ''}`}>{u.role}</Chip>
                {u.authType && (
                  <Chip size="sm" variant="primary" className="font-bold text-[10px] uppercase tracking-wider opacity-70 border-border/50">
                    {u.authType === 'oidc' ? 'OIDC' : 'Lokal'}
                  </Chip>
                )}
                {u.canSubmitApps === false && (
                  <Chip size="sm" variant="soft" color="warning" className="font-bold text-[10px] uppercase tracking-wider bg-warning/10 text-warning">App Erstellung Gesperrt</Chip>
                )}
                {u.disabled && <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider bg-danger/10 text-danger">Deaktiviert</Chip>}
              </div>
              <div className="text-sm text-muted flex items-center justify-center md:justify-start gap-2">
                <div className="bg-surface-secondary px-2 py-1 rounded-md border border-border/50 font-mono text-[11px]">
                  {u.email}
                </div>
              </div>
            </div>
            <div className="flex flex-row gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0 items-center justify-end">
              <Button 
                size="sm" 
                variant="secondary"
                onPress={() => handleEditUser(u)}
                className="font-bold gap-2 hidden md:flex"
              >
                <Pencil className="w-4 h-4 text-muted" />
                Bearbeiten
              </Button>
              
              <Dropdown>
                <Button aria-label="Benutzer Aktionen" size="sm" variant="secondary" isIconOnly>
                  <MoreVertical className="w-4 h-4" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu aria-label="Benutzer Aktionen" onAction={(key) => {
                    if (key === 'state') handleToggleUserState(u);
                    if (key === 'submission') handleToggleUserSubmission(u);
                    if (key === 'edit') handleEditUser(u);
                    if (key === 'delete') handleDeleteUser(u.id);
                  }}>
                    <Dropdown.Item id="state" textValue={u.disabled ? 'Konto Aktivieren' : 'Konto Sperren'}>
                       <div className={`flex items-center gap-2 ${u.disabled ? 'text-success' : 'text-danger'}`}>
                          {u.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {u.disabled ? 'Konto Aktivieren' : 'Konto Sperren'}
                      </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="submission" textValue={u.canSubmitApps === false ? 'Einreichung Erlauben' : 'Einreichung Sperren'}>
                        <div className={`flex items-center gap-2 ${u.canSubmitApps === false ? 'text-success' : 'text-danger'}`}>
                            {u.canSubmitApps === false ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            {u.canSubmitApps === false ? 'Einreichung Erlauben' : 'Einreichung Sperren'}
                        </div>
                    </Dropdown.Item>
                    <Dropdown.Item id="edit" textValue="Bearbeiten">
                        <div className="flex items-center gap-2">
                            <Pencil className="w-4 h-4" /> Bearbeiten
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
          </div>
        </Card>
      ))}
    </div>
  );
}
