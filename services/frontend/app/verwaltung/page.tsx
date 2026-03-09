'use client';

import { AppModal } from '@/components/AppModal';
import { AppConfig } from '@/config/apps';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  Switch,
  Tabs,
  TextField
} from '@heroui/react';
import {
  ChevronLeft,
  Download,
  Globe,
  Layers,
  Loader2,
  Plus,
  ShieldCheck,
  Upload,
  UserPlus,
  Users as UsersIcon
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { AppTable } from '../../components/AppTable';
import { UserTable } from '../../components/UserTable';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

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

function ManagementContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'apps' | 'users'>('apps');
  const [globalSettings, setGlobalSettings] = useState({ 
    allowAppSubmissions: true,
    showTopBanner: false,
    topBannerText: ''
  });

  const handleUpdateSettings = async (newSettings: typeof globalSettings) => {
    try {
      const res = await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings)
      });
      if (res.ok) setGlobalSettings(newSettings);
    } catch (err) { console.error(err); }
  };
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  
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
        // Fetch global settings always
        const settingsRes = await fetchApi('/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setGlobalSettings(settingsData);
        }

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

  const handleToggleUserSubmission = async (u: SystemUser) => {
    try {
      const newSubmissionStatus = !(u.canSubmitApps === true);
      
      const payload = {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        canSubmitApps: newSubmissionStatus
      };
      
      const res = await fetchApi(`/admin/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        loadUsers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to update submission status:", errorData);
      }
    } catch (err) { 
      console.error("Submission toggle error:", err); 
    }
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
      authority: '',
      knownIssue: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: '',
      customHelmValues: '',
      isFeatured: false,
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

  const handleToggleAppLock = async (app: AppConfig) => {
    try {
      const payload = { ...app, isLocked: !app.isLocked };
      const res = await fetchApi(`/apps/${app.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.ok) loadApps();
    } catch (err) { console.error(err); }
  };

  const handleAppSubmit = async (formData: Partial<AppConfig>) => {
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
      ...formData,
      categories: Array.isArray(formData.categories)
        ? formData.categories
        : (formData.categories as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      techStack: Array.isArray(formData.techStack) 
        ? formData.techStack 
        : (formData.techStack as unknown as string).split(',').map(s => s.trim()).filter(Boolean),
      repositories: sanitizeLinks(formData.repositories),
      customLinks: sanitizeLinks(formData.customLinks)
    };

    try {
      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(finalData)
      });
      if (res.ok) {
        loadApps();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Fehler beim Speichern: ${res.statusText}`);
        return false;
      }
    } catch (err) {
      console.error(err);
      setError(`Verbindungsfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`);
      return false;
    }
  };

  // Deep linking
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && apps.length > 0) {
      const appToEdit = apps.find(a => a.id === editId);
      if (appToEdit) {
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
            <h1 className="text-3xl font-bold text-foreground mb-1 tracking-tight">Verwaltung & Plattform</h1>
            <p className="text-muted">Verwalten Sie Applikationen, Benutzer und globale Store-Einstellungen.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
               variant="secondary" 
               className="gap-2 border-border/50"
               onPress={() => router.push('/')}
            >
              <ChevronLeft className="w-4 h-4" /> Zum Store
            </Button>
            <Button 
              className="bg-accent text-white gap-2 shadow-lg shadow-accent/20 font-medium"
              onPress={handleCreateApp}
            >
              <Plus className="w-4 h-4" /> App hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <Surface className="p-6 border border-border/50 shadow-sm relative overflow-hidden group">
            <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-6 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" /> Submission Control
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">App-Einreichungen erlauben</span>
                <p className="text-xs text-muted max-w-[200px]">Geben Sie Benutzern die Freiheit, eigene Apps vorzuschlagen.</p>
              </div>
              <Switch 
                isSelected={globalSettings.allowAppSubmissions}
                onChange={(val) => handleUpdateSettings({ ...globalSettings, allowAppSubmissions: val })}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          </Surface>

          <Surface className="p-6 border border-border/50 shadow-sm relative overflow-hidden group">
            <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" /> Top Store Banner
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 items-end">
                <TextField 
                  className="flex-grow"
                  value={globalSettings.topBannerText}
                  onChange={(val) => setGlobalSettings({ ...globalSettings, topBannerText: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Banner Text</Label>
                  <Input placeholder="Ankündigung hier eingeben..." className="bg-field-background" />
                </TextField>
                <Button 
                  size="sm"
                  className="bg-accent text-white"
                  onPress={() => handleUpdateSettings(globalSettings)}
                >
                  Speichern
                </Button>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">Status</span>
                <Switch 
                  isSelected={globalSettings.showTopBanner}
                  onChange={(val) => handleUpdateSettings({ ...globalSettings, showTopBanner: val })}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>
          </Surface>
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

          <div className="flex justify-end gap-2 mb-4">
            {activeTab === 'apps' && (
              <>
                <Button variant="secondary" size="sm" onPress={handleExportApps} className="gap-2">
                  <Download className="w-4 h-4" /> Export
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportApps}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Upload className="w-4 h-4" /> Import
                  </Button>
                </div>
              </>
            )}
            {activeTab === 'users' && (
              <Button size="sm" onPress={handleCreateUser} className="bg-accent text-white gap-2">
                <UserPlus className="w-4 h-4" /> Benutzer einladen
              </Button>
            )}
          </div>

          <Tabs.Panel id="apps" className="pt-6">
          <AppTable 
            apps={apps} 
            handleEditApp={handleEditApp} 
            handleDeleteApp={handleDeleteApp} 
            handleToggleAppLock={handleToggleAppLock} 
          />
        </Tabs.Panel>

        <Tabs.Panel id="users" className="pt-6">
          <UserTable 
            users={users} 
            handleEditUser={handleEditUser} 
            handleDeleteUser={handleDeleteUser} 
            handleToggleUserState={handleToggleUserState} 
            handleToggleUserSubmission={handleToggleUserSubmission} 
          />
        </Tabs.Panel>
      </Tabs>

      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}

      {/* App Modal */}
      <AppModal
        isOpen={isAppModalOpen}
        onOpenChange={setIsAppModalOpen}
        selectedApp={selectedApp}
        onSubmit={handleAppSubmit}
        initialData={appFormData}
        existingApps={apps}
      />

      {/* User Modal */}

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
