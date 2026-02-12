'use client';

import { AppConfig } from '@/config/apps';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Surface,
  Tabs,
  TextArea,
  TextField
} from '@heroui/react';
import {
  BookOpen,
  ChevronLeft,
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
  
  // App Modal states
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>({});

  // User Modal states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<SystemUser & { password?: string }>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
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
  const handleCreateApp = () => {
    setSelectedApp(null);
    setAppFormData({
      id: '',
      name: '',
      description: '',
      category: '',
      icon: '🏛️',
      techStack: [],
      license: 'MIT',
      markdownContent: '',
      liveUrl: '',
      repoUrl: '',
      dockerRepo: '',
      helmRepo: '',
      docsUrl: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: ''
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
    
    const finalData = {
      ...appFormData,
      techStack: Array.isArray(appFormData.techStack) 
        ? appFormData.techStack 
        : (appFormData.techStack as unknown as string).split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(finalData)
      });
      if (res.ok) {
        setIsAppModalOpen(false);
        loadApps();
      }
    } catch (err) {
      console.error(err);
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

  if (authLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-bund-blue" />
      <p className="text-default-500 font-medium">Verwaltung wird vorbereitet...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-bund-black mb-1">Verwaltung</h1>
          <p className="text-default-500">Verwalten Sie Applikationen und Benutzer im Store.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary"
            onPress={() => router.push('/')}
            className="font-bold gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Zum Store
          </Button>
          {activeTab === 'apps' ? (
            <Button 
              onPress={handleCreateApp} 
              className="bg-bund-blue text-white font-bold gap-2 shadow-md hover:scale-[1.02] transition-transform"
            >
              <Plus className="w-4 h-4" />
              Neue App
            </Button>
          ) : (
            <Button 
              onPress={handleCreateUser} 
              className="bg-bund-blue text-white font-bold gap-2 shadow-md hover:scale-[1.02] transition-transform"
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
        <Tabs.ListContainer className="border-b border-default-200">
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
          <div className="grid grid-cols-1 gap-4">
            {apps.map((app) => (
              <Card key={app.id} variant="default" className="hover:border-bund-blue/30 transition-colors border-default-200">
                <div className="flex flex-col md:flex-row items-center p-4 gap-6">
                  <div className="w-16 h-16 rounded-xl bg-default-100 flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
                    {app.icon || "🏛️"}
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                      <h3 className="text-lg font-bold text-bund-black">{app.name}</h3>
                      <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase">{app.category}</Chip>
                    </div>
                    <div className="text-sm text-default-500 line-clamp-1 mb-2">{app.description}</div>
                    <div className="text-[10px] font-mono text-default-400 bg-default-50 px-2 py-0.5 rounded w-fit mx-auto md:mx-0">ID: {app.id}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="tertiary"
                      onPress={() => router.push(`/apps/${app.id}`)}
                      className="font-bold gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Details
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleEditApp(app)}
                      className="font-bold gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger-soft"
                      onPress={() => handleDeleteApp(app.id)}
                      className="font-bold gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {apps.length === 0 && !loading && (
              <div className="py-20 text-center bg-default-50 rounded-2xl border-2 border-dashed border-default-200">
                <p className="text-default-400 font-medium">Noch keine Apps vorhanden.</p>
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
              <Card key={u.id} variant="default" className="hover:border-bund-blue/30 transition-colors border-default-200">
                <div className="flex flex-col md:flex-row items-center p-4 gap-6">
                  <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                    {u.role === 'admin' ? <ShieldCheck className="text-bund-blue" /> : <User className="text-default-500" />}
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                      <h3 className="text-lg font-bold text-bund-black">{u.username}</h3>
                      <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase text-accent-foreground">{u.role}</Chip>
                      {u.disabled && <Chip size="sm" variant="soft" className="font-bold text-[10px] uppercase text-danger-foreground">Deaktiviert</Chip>}
                    </div>
                    <div className="text-sm text-default-500">{u.email}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleToggleUserState(u)}
                      className="font-bold gap-1.5"
                    >
                      {u.disabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {u.disabled ? 'Aktivieren' : 'Sperren'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onPress={() => handleEditUser(u)}
                      className="font-bold gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger-soft"
                      onPress={() => handleDeleteUser(u.id)}
                      className="font-bold gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {users.length === 0 && !loading && (
              <div className="py-20 text-center bg-default-50 rounded-2xl border-2 border-dashed border-default-200">
                <p className="text-default-400 font-medium">Noch keine Benutzer vorhanden.</p>
              </div>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-bund-blue" />
        </div>
      )}

      {/* App Modal */}
      <Modal isOpen={isAppModalOpen} onOpenChange={setIsAppModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-4xl">
              <form onSubmit={handleAppSubmit} className="flex flex-col h-full">
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-default-200 bg-default-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-bund-blue/10 flex items-center justify-center text-xl">
                      {appFormData.icon || "🏛️"}
                    </div>
                    <div>
                      <Modal.Heading className="text-xl font-bold text-bund-black">
                        {selectedApp ? 'App bearbeiten' : 'Neue App erstellen'}
                      </Modal.Heading>
                      <p className="text-xs text-default-500">
                        {selectedApp ? `Änderungen an ID: ${selectedApp.id}` : 'Konfigurieren Sie die Basisdaten Ihrer App.'}
                      </p>
                    </div>
                  </div>
                </Modal.Header>
                
                <Modal.Body className="p-0 overflow-hidden">
                  <Tabs variant="secondary" className="h-full flex flex-col" defaultSelectedKey="general">
                    <Tabs.ListContainer className="px-8 border-b border-default-200 bg-white sticky top-0 z-10">
                      <Tabs.List aria-label="App configuration sections" className="gap-8">
                        <Tabs.Tab id="general" className="gap-2 py-4 font-bold text-sm">
                          <Info className="w-4 h-4" /> Allgemein
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="technical" className="gap-2 py-4 font-bold text-sm">
                          <Server className="w-4 h-4" /> Integration
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
                      <Tabs.Panel id="general" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField isRequired value={appFormData.name || ''} onChange={(val) => setAppFormData({...appFormData, name: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">App Name</Label>
                            <Input value={appFormData.name || ''} placeholder="z.B. Digi-Sign Pro" className="bg-white" />
                          </TextField>
                          <TextField isRequired value={appFormData.id || ''} onChange={(val) => setAppFormData({...appFormData, id: val})} isDisabled={!!selectedApp}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Unique ID (URL)</Label>
                            <Input value={appFormData.id || ''} placeholder="z.B. digi-sign-pro" className="bg-white font-mono" />
                          </TextField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField isRequired value={appFormData.category || ''} onChange={(val) => setAppFormData({...appFormData, category: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Kategorie</Label>
                            <Input value={appFormData.category || ''} placeholder="Infrastruktur, Tools..." className="bg-white" />
                          </TextField>
                          <TextField value={appFormData.icon || ''} onChange={(val) => setAppFormData({...appFormData, icon: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Icon (Emoji / URL)</Label>
                            <Input value={appFormData.icon || ''} placeholder="🏛️" className="bg-white" />
                          </TextField>
                        </div>

                        <TextField value={appFormData.description || ''} onChange={(val) => setAppFormData({...appFormData, description: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Kurzbeschreibung</Label>
                          <TextArea value={appFormData.description || ''} placeholder="Eine kurze Zusammenfassung für die Store-Übersicht" className="bg-white" />
                        </TextField>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField value={Array.isArray(appFormData.techStack) ? appFormData.techStack.join(', ') : ''} onChange={(val) => setAppFormData({...appFormData, techStack: val.split(',').map(s => s.trim())})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Tech Stack (Komma-separiert)</Label>
                            <Input value={Array.isArray(appFormData.techStack) ? appFormData.techStack.join(', ') : ''} placeholder="React, Go, PostgreSQL" className="bg-white" />
                          </TextField>
                          <TextField value={appFormData.license || ''} onChange={(val) => setAppFormData({...appFormData, license: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Lizenz</Label>
                            <Input value={appFormData.license || ''} placeholder="MIT, Apache 2.0" className="bg-white" />
                          </TextField>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="technical" className="space-y-6">
                        <Surface variant="default" className="p-4 bg-accent-50 rounded-xl border border-accent-100 flex gap-4 text-accent-700">
                          <Layers className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm">Geben Sie hier die URLs für Deployments und Source-Code an.</p>
                        </Surface>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField value={appFormData.liveUrl || ''} onChange={(val) => setAppFormData({...appFormData, liveUrl: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Live URL</Label>
                            <Input value={appFormData.liveUrl || ''} placeholder="https://app.bund.de" className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={appFormData.repoUrl || ''} onChange={(val) => setAppFormData({...appFormData, repoUrl: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Github className="w-3 h-3" /> Repository URL</Label>
                            <Input value={appFormData.repoUrl || ''} placeholder="https://github.com/bund/app" className="bg-white font-mono text-sm" />
                          </TextField>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField value={appFormData.dockerRepo || ''} onChange={(val) => setAppFormData({...appFormData, dockerRepo: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Docker Image</Label>
                            <Input value={appFormData.dockerRepo || ''} placeholder="ghcr.io/bund/image:latest" className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={appFormData.helmRepo || ''} onChange={(val) => setAppFormData({...appFormData, helmRepo: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Helm Chart</Label>
                            <Input value={appFormData.helmRepo || ''} placeholder="oci://ghcr.io/bund/charts/app" className="bg-white font-mono text-sm" />
                          </TextField>
                        </div>

                        <TextField value={appFormData.docsUrl || ''} onChange={(val) => setAppFormData({...appFormData, docsUrl: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Externe Dokumentation URL</Label>
                          <Input value={appFormData.docsUrl || ''} placeholder="https://docs.bund.de" className="bg-white font-mono text-sm" />
                        </TextField>
                      </Tabs.Panel>

                      <Tabs.Panel id="deployment" className="space-y-6">
                        <Surface variant="default" className="p-4 bg-default-50 rounded-xl border border-default-200 flex gap-4 text-default-600">
                          <Terminal className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm">Passen Sie die Deployment-Befehle an. Wenn leer, werden Standard-Befehle generiert.</p>
                        </Surface>

                        <div className="space-y-4">
                          <TextField value={appFormData.customDockerCommand || ''} onChange={(val) => setAppFormData({...appFormData, customDockerCommand: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Docker Command</Label>
                            <TextArea value={appFormData.customDockerCommand || ''} placeholder="docker run -d ..." className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={appFormData.customDockerNote || ''} onChange={(val) => setAppFormData({...appFormData, customDockerNote: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Docker Note</Label>
                            <Input value={appFormData.customDockerNote || ''} placeholder="Hinweis für Docker..." className="bg-white" />
                          </TextField>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-4">
                          <TextField value={appFormData.customComposeCommand || ''} onChange={(val) => setAppFormData({...appFormData, customComposeCommand: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Docker Compose</Label>
                            <TextArea value={appFormData.customComposeCommand || ''} placeholder="services: ..." className="bg-white font-mono text-sm" rows={5} />
                          </TextField>
                          <TextField value={appFormData.customComposeNote || ''} onChange={(val) => setAppFormData({...appFormData, customComposeNote: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Compose Note</Label>
                            <Input value={appFormData.customComposeNote || ''} placeholder="Hinweis für Compose..." className="bg-white" />
                          </TextField>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-4">
                          <TextField value={appFormData.customHelmCommand || ''} onChange={(val) => setAppFormData({...appFormData, customHelmCommand: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Helm Command</Label>
                            <TextArea value={appFormData.customHelmCommand || ''} placeholder="helm install ..." className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={appFormData.customHelmNote || ''} onChange={(val) => setAppFormData({...appFormData, customHelmNote: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Helm Note</Label>
                            <Input value={appFormData.customHelmNote || ''} placeholder="Hinweis für Helm..." className="bg-white" />
                          </TextField>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="docs" className="space-y-6 h-full flex flex-col">
                        <TextField className="flex-grow flex flex-col" value={appFormData.markdownContent || ''} onChange={(val) => setAppFormData({...appFormData, markdownContent: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Interne Dokumentation (Markdown)</Label>
                          <TextArea 
                            value={appFormData.markdownContent || ''}
                            placeholder="# Dokumentation\n\nBeschreiben Sie hier Details zur Installation..." 
                            className="bg-white font-mono text-sm md:h-[380px] w-full" 
                          />
                        </TextField>
                        <p className="text-[10px] text-default-400 italic">Nutzen Sie Markdown für Formatierungen, Code-Blöcke und Tabellen.</p>
                      </Tabs.Panel>
                    </div>
                  </Tabs>
                </Modal.Body>
                
                <Modal.Footer className="px-8 py-6 border-t border-default-200 bg-default-50/50 justify-end gap-3 sticky bottom-0">
                  <Button variant="secondary" onPress={() => setIsAppModalOpen(false)} className="font-bold">
                    Abbrechen
                  </Button>
                  <Button type="submit" className="bg-bund-blue text-white font-bold px-8 shadow-md">
                    {selectedApp ? 'Änderungen speichern' : 'App erstellen'}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-md">
              <form onSubmit={handleUserSubmit}>
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-default-200">
                  <Modal.Heading className="text-xl font-bold text-bund-black">
                    {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="px-8 py-6 space-y-4">
                  <TextField isRequired value={userFormData.username || ''} onChange={(val) => setUserFormData({...userFormData, username: val})}>
                    <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Benutzername</Label>
                    <Input value={userFormData.username || ''} placeholder="max.mustermann" className="bg-white" />
                  </TextField>
                  <TextField isRequired type="email" value={userFormData.email || ''} onChange={(val) => setUserFormData({...userFormData, email: val})}>
                    <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Email</Label>
                    <Input value={userFormData.email || ''} placeholder="max@beispiel.de" className="bg-white" />
                  </TextField>
                  {!selectedUser && (
                    <TextField isRequired type="password" value={userFormData.password || ''} onChange={(val) => setUserFormData({...userFormData, password: val})}>
                      <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Passwort</Label>
                      <Input value={userFormData.password || ''} placeholder="******" className="bg-white" />
                    </TextField>
                  )}
                  <div className="flex flex-col gap-2">
                    <Select 
                       selectedKey={userFormData.role || 'user'}
                       onSelectionChange={(key) => setUserFormData({...userFormData, role: key as string})}
                       className="w-full"
                    >
                      <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Rolle</Label>
                      <Select.Trigger className="bg-white border-default-200">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="user" textValue="User">User</ListBox.Item>
                          <ListBox.Item id="admin" textValue="Admin">Admin</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                </Modal.Body>
                <Modal.Footer className="px-8 py-6 border-t border-default-200">
                  <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" slot="close" className="px-6 font-bold">
                      Abbrechen
                    </Button>
                    <Button type="submit" className="bg-bund-blue text-white px-8 font-bold shadow-lg">
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
