'use client';

import { AppConfig } from '@/config/apps';
import {
  Button,
  Card,
  Chip,
  ComboBox,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Surface,
  Switch,
  Tabs,
  TextArea,
  TextField
} from '@heroui/react';
import {
  BookOpen,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Github,
  Globe,
  Info,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  Unlock,
  Upload,
  User,
  UserPlus,
  Users as UsersIcon
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: string;
  disabled: boolean;
  disabled_reason?: string;
  created_at: string;
}

function ManagementContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'apps' | 'users'>('apps');

  // Modal & Form states
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  
  const [iconInput, setIconInput] = useState('');
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>({});
  const [userFormData, setUserFormData] = useState<Partial<SystemUser & { password?: string }>>({});

  // Unified auth check
  useEffect(() => {
    // Detailed log to help diagnose the issue
    console.debug("[Management] Auth state check:", { authLoading, status: user ? "resolved" : "null", role: user?.role });

    // Only redirect if we are CERTAIN the user is not an admin
    if (!authLoading) {
      if (!user) {
        // Wait another 500ms to be absolutely sure it's not a hydration/session flicker
        const timer = setTimeout(() => {
          if (!user) {
            console.warn("[Management] No user after settling, redirecting...");
            router.push('/');
          }
        }, 500);
        return () => clearTimeout(timer);
      } else if (user.role !== 'admin') {
        console.warn("[Management] User role is not admin:", user.role, "redirecting...");
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'apps') {
          const res = await fetchApi('/apps');
          if (res.ok) {
            const data = await res.json();
            setApps(data);
          } else {
            setError(`Failed to load apps: ${res.statusText}`);
          }
        } else {
          const res = await fetchApi('/admin/users');
          if (res.ok) {
            const data = await res.json();
            setUsers(data.users || []);
          } else if (res.status === 401) {
            setError('Sitzung abgelaufen. Bitte melden Sie sich erneut an.');
          } else {
            setError(`Failed to load users: ${res.status} ${res.statusText}`);
          }
        }
      } catch (err) {
        setError(`Error connecting to API: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  const loadApps = async () => {
    try {
      const res = await fetchApi('/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      }
    } catch (err) { console.error(err); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetchApi('/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else if (res.status === 401) {
        setError('Unauthorized: You might not be an admin on the backend.');
      }
    } catch (err) { console.error(err); }
  };

  // User Handlers
  const handleCreateUser = () => {
    setSelectedUser(null);
    setUserFormData({
      username: '',
      email: '',
      role: 'user',
      password: ''
    });
    setIsUserModalOpen(true);
  };

  const handleEditUser = (u: SystemUser) => {
    setSelectedUser(u);
    setUserFormData({ ...u });
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Benutzer wirklich löschen?')) return;
    try {
      const res = await fetchApi(`/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) loadUsers();
    } catch (err) { console.error(err); }
  };

  const handleToggleUserState = async (u: SystemUser) => {
    try {
      const res = await fetchApi(`/admin/users/${u.id}/state`, {
        method: 'PUT',
        body: JSON.stringify({ disabled: !u.disabled })
      });
      if (res.ok) loadUsers();
    } catch (err) { console.error(err); }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = selectedUser ? 'PUT' : 'POST';
    const url = selectedUser ? `/admin/users/${selectedUser.id}` : '/admin/users';
    
    try {
      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(userFormData)
      });
      if (res.ok) {
        setIsUserModalOpen(false);
        loadUsers();
      }
    } catch (err) { console.error(err); }
  };

  // App Handlers
  const handleExportApps = async () => {
    try {
      const res = await fetchApi('/apps/export');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apps-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Export fehlgeschlagen');
      }
    } catch (err) {
      console.error(err);
      alert('Export fehlgeschlagen');
    }
  };

  const handleImportApps = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const appsData = JSON.parse(content);
        
        const res = await fetchApi('/apps/import', {
          method: 'POST',
          body: JSON.stringify(appsData)
        });

        if (res.ok) {
          alert('Apps erfolgreich importiert');
          loadApps();
        } else {
          alert('Import fehlgeschlagen');
        }
      } catch (err) {
        console.error(err);
        alert('Fehler beim Importieren der Datei');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleCreateApp = () => {
    setSelectedApp(null);
    setAppFormData({
      id: '',
      name: '',
      description: '',
      categories: [],
      icon: '🏛️',
      techStack: [],
      license: 'MIT',
      markdownContent: '',
      liveUrl: '',
      liveDemos: [],
      repoUrl: '',
      repositories: [],
      customLinks: [],
      dockerRepo: '',
      helmRepo: '',
      docsUrl: '',
      focus: '',
      appType: '',
      useCase: '',
      visualization: '',
      deployment: '',
      infrastructure: '',
      database: '',
      additionalInfo: '',
      status: 'POC',
      transferability: '',
      contactPerson: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: '',
      hasDeploymentAssistant: true,
      showDocker: true,
      showCompose: true,
      showHelm: true
    });
    setIsAppModalOpen(true);
  };

  const handleEditApp = (app: AppConfig) => {
    setSelectedApp(app);
    setAppFormData({ ...app });
    setIsAppModalOpen(true);
  };

  const handleDeleteApp = async (id: string) => {
    if (confirm('Bist du sicher? Diese App wird unwiderruflich gelöscht.')) {
      await fetchApi(`/apps/${id}`, { method: 'DELETE' });
      loadApps();
    }
  };

  const handleAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = selectedApp ? 'PUT' : 'POST';
    const url = selectedApp ? `/apps/${selectedApp.id}` : '/apps';

    const sanitizeLinks = (links: { label?: string; url?: string }[] | undefined) => {
      if (!Array.isArray(links)) return [];
      return links
        .map(link => ({
          label: (link.label || '').trim(),
          url: (link.url || '').trim()
        }))
        .filter(link => link.url.length > 0)
        .map(link => ({
          label: link.label || 'Link',
          url: link.url
        }));
    };
    
    const finalData = {
      ...appFormData,
      categories: Array.isArray(appFormData.categories)
        ? appFormData.categories
        : (appFormData.categories as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      techStack: Array.isArray(appFormData.techStack) 
        ? appFormData.techStack 
        : (appFormData.techStack as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      repositories: sanitizeLinks(appFormData.repositories),
      customLinks: sanitizeLinks(appFormData.customLinks)
    };

    try {
      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(finalData)
      });
      if (res.ok) {
        setIsAppModalOpen(false);
        loadApps();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Fehler beim Speichern: ${res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
    }
  };

  // Deep linking
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && apps.length > 0) {
      const appToEdit = apps.find(a => a.id === editId);
      if (appToEdit) {
        // Use a timeout to avoid synchronous state update in effect which causes cascading renders
        const timer = setTimeout(() => {
          handleEditApp(appToEdit);
          const url = new URL(window.location.href);
          url.searchParams.delete('edit');
          window.history.replaceState({}, '', url.pathname);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams, apps]);

  // Keep the local icon input in sync when modal opens / form data changes
  useEffect(() => {
    if (isAppModalOpen) {
      setIconInput(appFormData.icon || '');
    }
  }, [isAppModalOpen, appFormData.icon]);

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
      <p className="text-muted font-medium">Verwaltung wird vorbereitet...</p>
    </div>
  );

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Verwaltung</h1>
          <p className="text-muted">Verwalten Sie Applikationen und Benutzer im PLAIN Community Store.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="secondary"
            onPress={() => router.push('/')}
            className="font-bold gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Zum PLAIN Community Store
          </Button>
          {activeTab === 'apps' ? (
            <>
              
            </>
          ) : (
            <Button 
              onPress={handleCreateUser} 
              className="bg-accent text-white font-medium gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Neuer Benutzer
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-grow">
            {error}
          </div>
          <Button size="sm" variant="secondary" onPress={() => setActiveTab(activeTab)} className="h-8">Retry</Button>
        </div>
      )}

      <Tabs 
        variant="secondary" 
        className="mb-8"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as 'apps' | 'users')}
      >
        <Tabs.ListContainer className="border-b border-border">
          <Tabs.List aria-label="Management sections" className="gap-8">
            <Tabs.Tab id="apps" className="gap-2 py-4 font-bold text-sm">
              <Layers className="w-4 h-4" /> Apps
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="users" className="gap-2 py-4 font-bold text-sm">
              <UsersIcon className="w-4 h-4" /> Benutzer
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="apps" className="pt-6">
          <div className='flex flex-cols gap-2 pb-4 justify-end'>
            <Button 
              onPress={handleCreateApp} 
              className="bg-accent text-white font-medium gap-2"
            >
              <Plus className="w-4 h-4" />
              Neue App
            </Button>
            <Button 
              variant="secondary"
              onPress={handleExportApps}
              className="font-bold gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <div className='relative'>
              <input
                type="file"
                accept=".json"
                onChange={handleImportApps}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="Apps importieren"
              />
              <Button 
                variant="secondary"
                className="font-bold gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {apps.map((app) => (
              <Card key={app.id} variant="default" className="hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group">
                <div className="flex flex-col md:flex-row items-center p-5 gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-secondary to-surface border border-border flex items-center justify-center text-3xl shadow-sm flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                    {app.icon?.startsWith('http') ? (
                      <img src={app.icon} alt={app.name} className="w-full h-full object-cover" />
                    ) : (
                      app.icon || "🏛️"
                    )}
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{app.name}</h3>
                      {app.categories?.slice(0, 3).map(cat => (
                        <Chip key={cat} size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">{cat}</Chip>
                      ))}
                      {(app.categories?.length || 0) > 3 && (
                        <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider">+{app.categories!.length - 3}</Chip>
                      )}
                    </div>
                    <div className="text-sm text-muted line-clamp-2 mb-3 max-w-3xl">{app.description || <span className="italic opacity-50">Keine Beschreibung</span>}</div>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <div className="text-[10px] font-mono text-muted bg-surface-secondary px-2 py-1 rounded-md border border-border/50 flex items-center gap-1.5">
                        <span className="opacity-50">ID:</span> {app.id}
                      </div>
                      {app.status && (
                        <div className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-md border border-accent/20 uppercase tracking-wider">
                          {app.status}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => router.push(`/apps/${app.id}`)}
                      className="font-bold gap-2 flex-1 md:flex-none justify-start"
                    >
                      <ExternalLink className="w-4 h-4 text-muted" />
                      Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleEditApp(app)}
                      className="font-bold gap-2 flex-1 md:flex-none justify-start"
                    >
                      <Pencil className="w-4 h-4 text-muted" />
                      Bearbeiten
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger-soft"
                      onPress={() => handleDeleteApp(app.id)}
                      className="font-bold gap-2 flex-1 md:flex-none justify-start"
                    >
                      <Trash2 className="w-4 h-4" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {apps.length === 0 && !loading && (
              <div className="py-20 text-center bg-surface-secondary rounded-2xl border-2 border-dashed border-border">
                <p className="text-muted font-medium">Noch keine Apps vorhanden.</p>
                <Button variant="ghost" onPress={handleCreateApp} className="mt-2">
                  Erste App erstellen
                </Button>
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="users" className="pt-6">
          <div className="grid grid-cols-1 gap-4">
            {users.map((u) => (
              <Card key={u.id} variant="default" className={`hover:border-accent/30 transition-all duration-200 border-border shadow-sm hover:shadow-md group ${u.disabled ? 'opacity-75' : ''}`}>
                <div className="flex flex-col md:flex-row items-center p-5 gap-6">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-sm flex-shrink-0 border ${u.role === 'admin' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-surface-secondary border-border text-muted'}`}>
                    {u.role === 'admin' ? <ShieldCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-1.5">
                      <h3 className="text-lg font-bold text-foreground">{u.username}</h3>
                      <Chip size="sm" variant="soft" className={`font-bold text-[10px] uppercase tracking-wider ${u.role === 'admin' ? 'bg-accent/10 text-accent' : ''}`}>{u.role}</Chip>
                      {u.disabled && <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase tracking-wider bg-danger/10 text-danger">Deaktiviert</Chip>}
                    </div>
                    <div className="text-sm text-muted flex items-center justify-center md:justify-start gap-2">
                      <div className="bg-surface-secondary px-2 py-1 rounded-md border border-border/50 font-mono text-[11px]">
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 flex-shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleToggleUserState(u)}
                      className={`font-bold gap-2 flex-1 md:flex-none justify-start ${u.disabled ? 'text-success hover:bg-success/10 hover:text-success' : 'text-warning hover:bg-warning/10 hover:text-warning'}`}
                    >
                      {u.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      {u.disabled ? 'Aktivieren' : 'Sperren'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleEditUser(u)}
                      className="font-bold gap-2 flex-1 md:flex-none justify-start"
                    >
                      <Pencil className="w-4 h-4 text-muted" />
                      Bearbeiten
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger-soft"
                      onPress={() => handleDeleteUser(u.id)}
                      className="font-bold gap-2 flex-1 md:flex-none justify-start"
                    >
                      <Trash2 className="w-4 h-4" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {users.length === 0 && !loading && (
              <div className="py-20 text-center bg-surface-secondary rounded-2xl border-2 border-dashed border-border">
                <p className="text-muted font-medium">Noch keine Benutzer vorhanden.</p>
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {/* App Modal */}
      <Modal>
        <Modal.Backdrop isOpen={isAppModalOpen} onOpenChange={setIsAppModalOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-4xl">
              <form onSubmit={handleAppSubmit} className="flex flex-col h-full">
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-border bg-surface-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xl overflow-hidden shrink-0">
                      {appFormData.icon?.startsWith('http') ? (
                        <img src={appFormData.icon} alt={appFormData.name} className="w-full h-full object-cover" />
                      ) : (
                        appFormData.icon || "🏛️"
                      )}
                    </div>
                    <div>
                      <Modal.Heading className="text-xl font-semibold text-foreground">
                        {selectedApp ? 'App bearbeiten' : 'Neue App erstellen'}
                      </Modal.Heading>
                      <p className="text-xs text-muted">
                        {selectedApp ? `Änderungen an ID: ${selectedApp.id}` : 'Konfigurieren Sie die Basisdaten Ihrer App.'}
                      </p>
                    </div>
                  </div>
                </Modal.Header>
                
                <Modal.Body className="p-0 overflow-hidden">
                  <Tabs variant="secondary" className="h-full flex flex-col" defaultSelectedKey="general">
                    <Tabs.ListContainer className="px-8 border-b border-border bg-surface sticky top-0 z-10">
                      <Tabs.List aria-label="App configuration sections" className="gap-8">
                        <Tabs.Tab id="general" className="gap-2 py-4 font-bold text-sm">
                          <Info className="w-4 h-4" /> Allgemein
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="technical" className="gap-2 py-4 font-bold text-sm">
                          <Server className="w-4 h-4" /> Integration
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="functional" className="gap-2 py-4 font-bold text-sm">
                          <Info className="w-4 h-4" /> Fachlich
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="deployment" className="gap-2 py-4 font-bold text-sm">
                          <Terminal className="w-4 h-4" /> Deployment
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="docs" className="gap-2 py-4 font-bold text-sm">
                          <FileText className="w-4 h-4" /> Dokumentation
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>

                    <div className="flex-grow overflow-y-auto px-8 py-8 md:h-[500px]">
                      <Tabs.Panel id="general" className="space-y-8">
                        {/* --- Basisinformationen --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Info className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Basisinformationen</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField isRequired onChange={(val) => setAppFormData({...appFormData, name: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">App Name</Label>
                              <Input value={appFormData.name || ''} placeholder="z.B. Digi-Sign Pro" className="bg-field-background" />
                            </TextField>
                            <TextField isRequired onChange={(val) => setAppFormData({...appFormData, id: val})} isDisabled={!!selectedApp}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Unique ID (URL)</Label>
                              <Input value={appFormData.id || ''} placeholder="z.B. digi-sign-pro" className="bg-field-background font-mono" />
                            </TextField>
                          </div>

                          <TextField onChange={(val) => setAppFormData({...appFormData, description: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Kurzbeschreibung</Label>
                            <TextArea value={appFormData.description || ''} placeholder="Eine kurze Zusammenfassung für die Store-Übersicht" className="bg-field-background min-h-[80px]" />
                          </TextField>
                        </div>

                        {/* --- Metadaten --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Layers className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Metadaten & Darstellung</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField isRequired onChange={(val) => setAppFormData({...appFormData, categories: val.split(',').map(s => s.trim())})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Kategorie(n) (Komma-separiert)</Label>
                              <Input value={Array.isArray(appFormData.categories) ? appFormData.categories.join(', ') : ''} placeholder="Verwaltung, Tools, Infrastruktur..." className="bg-field-background" />
                            </TextField>
                            <ComboBox
                              inputValue={iconInput}
                              onInputChange={(val) => setIconInput(val)}
                              selectedKey={appFormData.icon}
                              onSelectionChange={(key) => {
                                if (key) {
                                  const v = key as string;
                                  setIconInput(v);
                                  setAppFormData({ ...appFormData, icon: v });
                                }
                              }}
                              className="w-full"
                            >
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Icon (Emoji / URL)</Label>
                              <ComboBox.InputGroup>
                                <Input
                                  placeholder="🏛️ oder https://..."
                                  className="bg-field-background h-10"
                                  onBlur={() => setAppFormData({ ...appFormData, icon: iconInput })}
                                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter') {
                                      // prevent form submit; persist icon and keep modal open
                                      e.preventDefault();
                                      setAppFormData({ ...appFormData, icon: iconInput });
                                    }
                                  }}
                                />
                                <ComboBox.Trigger className="bg-field-background border-none px-2 h-10 flex items-center justify-center">
                                  <Plus className="w-4 h-4 text-muted" />
                                </ComboBox.Trigger>
                              </ComboBox.InputGroup>
                              <ComboBox.Popover>
                                <ListBox className="max-h-60 overflow-y-auto">
                                  {['🏛️', '📊', '💬', '🔐', '📅', '🚀', '🛠️', '📱', '🛡️', '⚙️', '📦', '📈', '🔑', '🏙️', '👥', '🗺️', '💰'].map(emoji => (
                                    <ListBox.Item key={emoji} id={emoji} textValue={emoji}>
                                      <div className="flex items-center justify-center p-1">
                                        <span className="text-2xl">{emoji}</span>
                                      </div>
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </ComboBox.Popover>
                              <p className="text-[10px] text-muted mt-1 italic">Wählen Sie ein Emoji oder fügen Sie eine Bild-URL ein (z. B. https://...)</p>
                            </ComboBox>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, techStack: val.split(',').map(s => s.trim())})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Tech Stack (Komma-separiert)</Label>
                              <Input value={Array.isArray(appFormData.techStack) ? appFormData.techStack.join(', ') : ''} placeholder="React, Go, PostgreSQL" className="bg-field-background" />
                            </TextField>
                            <TextField onChange={(val) => setAppFormData({...appFormData, license: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Lizenz</Label>
                              <Input value={appFormData.license || ''} placeholder="MIT, Apache 2.0" className="bg-field-background" />
                            </TextField>
                          </div>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="technical" className="space-y-8">
                        <Surface variant="default" className="p-4 bg-accent/10 rounded-lg border border-accent/20 flex gap-4 text-accent">
                          <Layers className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm">Geben Sie hier die URLs für Deployments und Source-Code an.</p>
                        </Surface>

                        {/* --- Live Demos Section --- */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-muted" />
                              <Label className="text-sm font-bold text-foreground">Live Demos</Label>
                            </div>
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              className="h-7 text-[10px] uppercase font-bold tracking-wider"
                              onPress={() => {
                                const demos = [...(appFormData.liveDemos || [])];
                                demos.push({ label: 'Live Demo', url: '' });
                                setAppFormData({ ...appFormData, liveDemos: demos });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Hinzufügen
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, liveUrl: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Standard Live URL (Fallback)</Label>
                              <Input value={appFormData.liveUrl || ''} placeholder="https://app.bund.de" className="bg-field-background font-mono text-sm" />
                            </TextField>
                          </div>

                          {(appFormData.liveDemos || []).length > 0 && (
                            <div className="space-y-3 mt-4">
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider">Zusätzliche Live Demos</Label>
                              {(appFormData.liveDemos || []).map((demo, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm group">
                                  <div className="md:col-span-4">
                                    <TextField 
                                      onChange={(val) => {
                                        const demos = [...(appFormData.liveDemos || [])];
                                        demos[idx] = { ...demos[idx], label: val };
                                        setAppFormData({ ...appFormData, liveDemos: demos });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Label</Label>
                                      <Input value={demo.label} placeholder="z.B. Produktion" className="bg-field-background" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-7">
                                    <TextField 
                                      onChange={(val) => {
                                        const demos = [...(appFormData.liveDemos || [])];
                                        demos[idx] = { ...demos[idx], url: val };
                                        setAppFormData({ ...appFormData, liveDemos: demos });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">URL</Label>
                                      <Input value={demo.url} placeholder="https://..." className="bg-field-background font-mono text-sm" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-1 flex justify-end pb-0.5">
                                    <Button 
                                      size="sm" 
                                      variant="secondary" 
                                      className="h-10 w-10 p-0 min-w-0 text-danger hover:bg-danger/10 border-none transition-colors"
                                      onPress={() => {
                                        const demos = [...(appFormData.liveDemos || [])];
                                        demos.splice(idx, 1);
                                        setAppFormData({ ...appFormData, liveDemos: demos });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* --- Repositories Section --- */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <div className="flex items-center gap-2">
                              <Github className="w-4 h-4 text-muted" />
                              <Label className="text-sm font-bold text-foreground">Repositories</Label>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[10px] uppercase font-bold tracking-wider"
                              onPress={() => {
                                const repositories = [...(appFormData.repositories || [])];
                                repositories.push({ label: 'Repository', url: '' });
                                setAppFormData({ ...appFormData, repositories });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Hinzufügen
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, repoUrl: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Legacy Repository URL (Fallback)</Label>
                              <Input value={appFormData.repoUrl || ''} placeholder="https://github.com/bund/app" className="bg-field-background font-mono text-sm" />
                            </TextField>
                          </div>

                          {(appFormData.repositories || []).length > 0 && (
                            <div className="space-y-3 mt-4">
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider">Zusätzliche Repositories</Label>
                              {(appFormData.repositories || []).map((repository, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm group">
                                  <div className="md:col-span-4">
                                    <TextField
                                      onChange={(val) => {
                                        const repositories = [...(appFormData.repositories || [])];
                                        repositories[idx] = { ...repositories[idx], label: val };
                                        setAppFormData({ ...appFormData, repositories });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Label</Label>
                                      <Input value={repository.label} placeholder="z.B. Backend" className="bg-field-background" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-7">
                                    <TextField
                                      onChange={(val) => {
                                        const repositories = [...(appFormData.repositories || [])];
                                        repositories[idx] = { ...repositories[idx], url: val };
                                        setAppFormData({ ...appFormData, repositories });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">URL</Label>
                                      <Input value={repository.url} placeholder="https://..." className="bg-field-background font-mono text-sm" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-1 flex justify-end pb-0.5">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-10 w-10 p-0 min-w-0 text-danger hover:bg-danger/10 border-none transition-colors"
                                      onPress={() => {
                                        const repositories = [...(appFormData.repositories || [])];
                                        repositories.splice(idx, 1);
                                        setAppFormData({ ...appFormData, repositories });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* --- Custom Links Section --- */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-border pb-2">
                            <div className="flex items-center gap-2">
                              <ExternalLink className="w-4 h-4 text-muted" />
                              <Label className="text-sm font-bold text-foreground">Custom Links</Label>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[10px] uppercase font-bold tracking-wider"
                              onPress={() => {
                                const customLinks = [...(appFormData.customLinks || [])];
                                customLinks.push({ label: 'Link', url: '' });
                                setAppFormData({ ...appFormData, customLinks });
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Hinzufügen
                            </Button>
                          </div>

                          {(appFormData.customLinks || []).length === 0 ? (
                            <p className="text-xs text-muted italic">Keine Custom Links konfiguriert.</p>
                          ) : (
                            <div className="space-y-3">
                              {(appFormData.customLinks || []).map((customLink, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm group">
                                  <div className="md:col-span-4">
                                    <TextField
                                      onChange={(val) => {
                                        const customLinks = [...(appFormData.customLinks || [])];
                                        customLinks[idx] = { ...customLinks[idx], label: val };
                                        setAppFormData({ ...appFormData, customLinks });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Label</Label>
                                      <Input value={customLink.label} placeholder="z.B. Product Page" className="bg-field-background" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-7">
                                    <TextField
                                      onChange={(val) => {
                                        const customLinks = [...(appFormData.customLinks || [])];
                                        customLinks[idx] = { ...customLinks[idx], url: val };
                                        setAppFormData({ ...appFormData, customLinks });
                                      }}
                                    >
                                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">URL</Label>
                                      <Input value={customLink.url} placeholder="https://..." className="bg-field-background font-mono text-sm" />
                                    </TextField>
                                  </div>
                                  <div className="md:col-span-1 flex justify-end pb-0.5">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-10 w-10 p-0 min-w-0 text-danger hover:bg-danger/10 border-none transition-colors"
                                      onPress={() => {
                                        const customLinks = [...(appFormData.customLinks || [])];
                                        customLinks.splice(idx, 1);
                                        setAppFormData({ ...appFormData, customLinks });
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* --- Deployment & Docs Section --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Server className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Deployment & Docs</Label>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, dockerRepo: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Docker Image</Label>
                              <Input value={appFormData.dockerRepo || ''} placeholder="ghcr.io/bund/image:latest" className="bg-field-background font-mono text-sm" />
                            </TextField>
                            <TextField onChange={(val) => setAppFormData({...appFormData, helmRepo: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Helm Chart</Label>
                              <Input value={appFormData.helmRepo || ''} placeholder="oci://ghcr.io/bund/charts/app" className="bg-field-background font-mono text-sm" />
                            </TextField>
                          </div>

                          <TextField onChange={(val) => setAppFormData({...appFormData, docsUrl: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Externe Dokumentation URL</Label>
                            <Input value={appFormData.docsUrl || ''} placeholder="https://docs.bund.de" className="bg-field-background font-mono text-sm" />
                          </TextField>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="functional" className="space-y-8">
                        {/* --- Klassifizierung & Zielsetzung --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Info className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Klassifizierung & Zielsetzung</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, focus: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Themenfeld / Schwerpunkt</Label>
                              <Input value={appFormData.focus || ''} placeholder="Digitale Signatur, KI..." className="bg-field-background" />
                            </TextField>
                            <TextField onChange={(val) => setAppFormData({...appFormData, appType: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Anwendungstyp</Label>
                              <Input value={appFormData.appType || ''} placeholder="Web-App, API, Bot..." className="bg-field-background" />
                            </TextField>
                          </div>

                          <TextField onChange={(val) => setAppFormData({...appFormData, useCase: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Ziel Anwendungsfall</Label>
                            <TextArea value={appFormData.useCase || ''} placeholder="Was soll mit der App erreicht werden?" className="bg-field-background" />
                          </TextField>
                        </div>

                        {/* --- Architektur & Technik --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Layers className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Architektur & Technik</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, visualization: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Visualisierung</Label>
                              <Input value={appFormData.visualization || ''} placeholder="Dashboard, Map, Chart..." className="bg-field-background" />
                            </TextField>
                            <TextField onChange={(val) => setAppFormData({...appFormData, deployment: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Deployment (Beschreibung)</Label>
                              <Input value={appFormData.deployment || ''} placeholder="Zentraler Betrieb, On-Premise..." className="bg-field-background" />
                            </TextField>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, infrastructure: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Infrastruktur</Label>
                              <Input value={appFormData.infrastructure || ''} placeholder="OpenShift, Kubernetes..." className="bg-field-background" />
                            </TextField>
                            <TextField onChange={(val) => setAppFormData({...appFormData, database: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Datenbasis</Label>
                              <Input value={appFormData.database || ''} placeholder="PostgreSQL, S3, LDAP..." className="bg-field-background" />
                            </TextField>
                          </div>
                        </div>

                        {/* --- Organisation & Status --- */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <ShieldCheck className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Organisation & Status</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">App Status</Label>
                              <Select 
                                value={['POC', 'MVP', 'Sandbox', 'Incubating', 'Graduated'].includes(appFormData.status || '') ? appFormData.status : 'custom'}
                                onChange={(key) => {
                                  if (key !== 'custom') {
                                    setAppFormData({...appFormData, status: key as string});
                                  }
                                }}
                                className="w-full"
                              >
                                <Select.Trigger className="bg-field-background border-none h-10 px-3">
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    <ListBox.Item id="POC" textValue="POC">POC (Machbarkeitsstudie)<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="MVP" textValue="MVP">MVP (Minimalprodukt)<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="Sandbox" textValue="Sandbox">Sandbox<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="Incubating" textValue="Incubating">In Inkubation<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="Graduated" textValue="Graduated">Graduated (Produktiv)<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="custom" textValue="Eigener Status...">Eigener Status...<ListBox.ItemIndicator /></ListBox.Item>
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            </div>
                            {(!['POC', 'MVP', 'Sandbox', 'Incubating', 'Graduated'].includes(appFormData.status || '') || appFormData.status === 'custom') && (
                              <TextField onChange={(val) => setAppFormData({...appFormData, status: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Eigener Status (Text)</Label>
                                <Input value={appFormData.status === 'custom' ? '' : appFormData.status || ''} placeholder="z.B. Pilot, Geplant..." className="bg-field-background" />
                              </TextField>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <TextField onChange={(val) => setAppFormData({...appFormData, contactPerson: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Ansprechpartner</Label>
                              <Input value={appFormData.contactPerson || ''} placeholder="Name (Ressort/Team)" className="bg-field-background" />
                            </TextField>

                            <TextField onChange={(val) => setAppFormData({...appFormData, transferability: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Auf andere Ressorts übertragbar</Label>
                              <Input value={appFormData.transferability || ''} placeholder="Gibt es Abhängigkeiten oder ist es generisch?" className="bg-field-background" />
                            </TextField>
                          </div>

                          <TextField onChange={(val) => setAppFormData({...appFormData, additionalInfo: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Sonstiges</Label>
                            <TextArea value={appFormData.additionalInfo || ''} placeholder="Weitere wichtige Informationen..." className="bg-field-background" />
                          </TextField>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="deployment" className="space-y-6">
                        <Surface variant="default" className="p-5 bg-surface-secondary rounded-xl border border-border space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Deployment Assistant aktivieren</Label>
                            <Switch 
                              isSelected={appFormData.hasDeploymentAssistant !== false} 
                              onChange={(isSelected) => setAppFormData({...appFormData, hasDeploymentAssistant: isSelected})}
                            >
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch>
                          </div>
                          
                          {appFormData.hasDeploymentAssistant !== false && (
                            <>
                              <Separator className="opacity-50" />
                              <div className="grid grid-cols-3 gap-4 pt-2">
                                <div className="flex flex-col gap-2 items-center">
                                  <Label className="text-[10px] uppercase font-bold text-muted">Docker</Label>
                                  <Switch 
                                    isSelected={appFormData.showDocker !== false} 
                                    onChange={(isSelected) => setAppFormData({...appFormData, showDocker: isSelected})}
                                  >
                                    <Switch.Control><Switch.Thumb /></Switch.Control>
                                  </Switch>
                                </div>
                                <div className="flex flex-col gap-2 items-center">
                                  <Label className="text-[10px] uppercase font-bold text-muted">Compose</Label>
                                  <Switch 
                                    isSelected={appFormData.showCompose !== false} 
                                    onChange={(isSelected) => setAppFormData({...appFormData, showCompose: isSelected})}
                                  >
                                    <Switch.Control><Switch.Thumb /></Switch.Control>
                                  </Switch>
                                </div>
                                <div className="flex flex-col gap-2 items-center">
                                  <Label className="text-[10px] uppercase font-bold text-muted">Helm</Label>
                                  <Switch 
                                    isSelected={appFormData.showHelm !== false} 
                                    onChange={(isSelected) => setAppFormData({...appFormData, showHelm: isSelected})}
                                  >
                                    <Switch.Control><Switch.Thumb /></Switch.Control>
                                  </Switch>
                                </div>
                              </div>
                            </>
                          )}
                        </Surface>

                        {appFormData.hasDeploymentAssistant !== false && (
                          <div className="space-y-6">
                            <Surface variant="default" className="p-4 bg-surface-secondary rounded-xl border border-border flex gap-4 text-muted">
                              <Terminal className="w-5 h-5 flex-shrink-0" />
                              <p className="text-sm">Passen Sie die Deployment-Befehle an. Wenn leer, werden Standard-Befehle generiert.</p>
                            </Surface>

                            <div className="space-y-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customDockerCommand: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Custom Docker Command</Label>
                                <TextArea value={appFormData.customDockerCommand || ''} placeholder="docker run -d ..." className="bg-field-background font-mono text-sm" />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customDockerNote: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Docker Note</Label>
                                <Input value={appFormData.customDockerNote || ''} placeholder="Hinweis für Docker..." className="bg-field-background" />
                              </TextField>
                            </div>

                            <Separator className="my-2" />

                            <div className="space-y-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customComposeCommand: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Custom Docker Compose</Label>
                                <TextArea value={appFormData.customComposeCommand || ''} placeholder="services: ..." className="bg-field-background font-mono text-sm" rows={5} />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customComposeNote: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Compose Note</Label>
                                <Input value={appFormData.customComposeNote || ''} placeholder="Hinweis für Compose..." className="bg-field-background" />
                              </TextField>
                            </div>

                            <Separator className="my-2" />

                            <div className="space-y-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customHelmCommand: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Custom Helm Command</Label>
                                <TextArea value={appFormData.customHelmCommand || ''} placeholder="helm install ..." className="bg-field-background font-mono text-sm" />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customHelmNote: val})}>
                                <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Helm Note</Label>
                                <Input value={appFormData.customHelmNote || ''} placeholder="Hinweis für Helm..." className="bg-field-background" />
                              </TextField>
                            </div>
                          </div>
                        )}
                      </Tabs.Panel>

                      <Tabs.Panel id="docs" className="space-y-6 h-full flex flex-col">
                        <TextField className="flex-grow flex flex-col" value={appFormData.markdownContent || ''} onChange={(val) => setAppFormData({...appFormData, markdownContent: val})}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Interne Dokumentation (Markdown)</Label>
                          <TextArea 
                            value={appFormData.markdownContent || ''}
                            placeholder="# Dokumentation\n\nBeschreiben Sie hier Details zur Installation..." 
                            className="bg-field-background font-mono text-sm md:h-[380px] w-full" 
                          />
                        </TextField>
                        <p className="text-[10px] text-muted italic">Nutzen Sie Markdown für Formatierungen, Code-Blöcke und Tabellen.</p>
                      </Tabs.Panel>
                    </div>
                  </Tabs>
                </Modal.Body>
                
                <Modal.Footer className="px-8 py-6 border-t border-border bg-surface-secondary/50 justify-end gap-3 sticky bottom-0">
                  <Button variant="secondary" onPress={() => setIsAppModalOpen(false)} className="font-bold">
                    Abbrechen
                  </Button>
                  <Button type="submit" className="bg-accent text-white font-medium px-8">
                    {selectedApp ? 'Änderungen speichern' : 'App erstellen'}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* User Modal */}
      <Modal>
        <Modal.Backdrop isOpen={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
              <form onSubmit={handleUserSubmit}>
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-border">
                  <Modal.Heading className="text-xl font-semibold text-foreground">
                    {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="px-8 py-6 space-y-4">
                  <TextField isRequired onChange={(val) => setUserFormData({...userFormData, username: val})}>
                    <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Benutzername</Label>
                    <Input value={userFormData.username || ''} placeholder="max.mustermann" className="bg-field-background" />
                  </TextField>
                  <TextField isRequired type="email" onChange={(val) => setUserFormData({...userFormData, email: val})}>
                    <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Email</Label>
                    <Input value={userFormData.email || ''} placeholder="max@beispiel.de" className="bg-field-background" />
                  </TextField>
                  {!selectedUser && (
                    <TextField isRequired type="password" onChange={(val) => setUserFormData({...userFormData, password: val})}>
                      <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Passwort</Label>
                      <Input value={userFormData.password || ''} placeholder="******" className="bg-field-background" />
                    </TextField>
                  )}
                  <div className="flex flex-col gap-2">
                    <Select 
                       value={userFormData.role || 'user'}
                       onChange={(key) => setUserFormData({...userFormData, role: key as string})}
                       className="w-full"
                    >
                      <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Rolle</Label>
                      <Select.Trigger className="bg-field-background border-border">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="user" textValue="User">User<ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="admin" textValue="Admin">Admin<ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </Modal.Body>
                <Modal.Footer className="px-8 py-6 border-t border-border">
                  <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" slot="close" className="px-6 font-bold">
                      Abbrechen
                    </Button>
                    <Button type="submit" className="bg-accent text-white px-8 font-medium">
                      Speichern
                    </Button>
                  </div>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default function ManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ManagementContent />
    </Suspense>
  );
}
