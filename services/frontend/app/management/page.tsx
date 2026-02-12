'use client';

import { AppConfig } from '@/config/apps';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Separator,
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
  Pencil,
  Plus,
  Server,
  Terminal,
  Trash2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

function ManagementContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppConfig | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<Partial<AppConfig>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    loadApps();
  }, []);

  // Handle deep-linking from detail page
  useEffect(() => {
    const editId = searchParams?.get('edit');
    if (editId && apps.length > 0) {
      const appToEdit = apps.find(a => a.id === editId);
      if (appToEdit) {
        handleEdit(appToEdit);
        // Clear param without reload
        window.history.replaceState({}, '', '/management');
      }
    }
  }, [searchParams, apps]);

  const loadApps = async () => {
    try {
      const res = await fetchApi('/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (app: AppConfig) => {
    setSelectedApp(app);
    setFormData(app);
    setIsOpen(true);
  };

  const handleCreate = () => {
    setSelectedApp(null);
    setFormData({
      id: '',
      name: '',
      description: '',
      category: '',
      icon: '🏛️',
      techStack: [],
      license: 'MIT',
      markdownContent: '',
      customDockerCommand: '',
      customComposeCommand: '',
      customHelmCommand: '',
      customDockerNote: '',
      customComposeNote: '',
      customHelmNote: ''
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bist du sicher? Diese App wird unwiderruflich gelöscht.')) {
      await fetchApi(`/apps/${id}`, { method: 'DELETE' });
      loadApps();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = selectedApp ? 'PUT' : 'POST';
    const url = selectedApp ? `/apps/${selectedApp.id}` : '/apps';
    
    const finalData = {
      ...formData,
      techStack: typeof formData.techStack === 'string' 
        ? (formData.techStack as string).split(',').map(s => s.trim()).filter(Boolean) 
        : formData.techStack
    };

    const res = await fetchApi(url, {
      method,
      body: JSON.stringify(finalData)
    });

    if (res.ok) {
      setIsOpen(false);
      loadApps();
    }
  };

  if (authLoading || loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-bund-blue" />
      <p className="text-default-500 font-medium">Verwaltung wird vorbereitet...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-bund-black mb-1">App Verwaltung</h1>
          <p className="text-default-500">Erstellen und bearbeiten Sie Applikationen im Store.</p>
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
          <Button 
            onPress={handleCreate} 
            className="bg-bund-blue text-white font-bold gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Neue App
          </Button>
        </div>
      </div>

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
                  <Chip size="sm" variant="soft" color="accent" className="font-bold text-[10px] uppercase">{app.category}</Chip>
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
                  onPress={() => handleEdit(app)}
                  className="font-bold gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="danger-soft"
                  onPress={() => handleDelete(app.id)}
                  className="font-bold gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Löschen
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {apps.length === 0 && (
          <div className="py-20 text-center bg-default-50 rounded-2xl border-2 border-dashed border-default-200">
            <p className="text-default-400 font-medium">Noch keine Apps vorhanden.</p>
            <Button variant="ghost" onPress={handleCreate} className="mt-2">
              Erste App erstellen
            </Button>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-4xl">
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                <Modal.CloseTrigger />
                <Modal.Header className="px-8 py-6 border-b border-default-200 bg-default-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-bund-blue/10 flex items-center justify-center text-xl">
                      {formData.icon || "🏛️"}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-bund-black">{selectedApp ? 'App bearbeiten' : 'Neue App erstellen'}</h2>
                      <p className="text-xs text-default-500">{selectedApp ? `Änderungen an ID: ${selectedApp.id}` : 'Konfigurieren Sie die Basisdaten Ihrer App.'}</p>
                    </div>
                  </div>
                </Modal.Header>
                
                <Modal.Body className="p-0 overflow-hidden">
                  <Tabs variant="secondary" className="h-full flex flex-col">
                    <Tabs.ListContainer className="px-8 border-b border-default-200 bg-white sticky top-0 z-10">
                      <Tabs.List aria-label="App sections" className="gap-8">
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

                    <div className="flex-grow overflow-y-auto px-8 py-8 h-[500px]">
                      <Tabs.Panel id="general" className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <TextField isRequired value={formData.name || ''} onChange={(val) => setFormData({...formData, name: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">App Name</Label>
                            <Input value={formData.name || ''} placeholder="z.B. Digi-Sign Pro" className="bg-white" />
                          </TextField>
                          <TextField isRequired value={formData.id || ''} onChange={(val) => setFormData({...formData, id: val})} isDisabled={!!selectedApp}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Unique ID (URL)</Label>
                            <Input value={formData.id || ''} placeholder="z.B. digi-sign-pro" className="bg-white font-mono" />
                          </TextField>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <TextField isRequired value={formData.category || ''} onChange={(val) => setFormData({...formData, category: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Kategorie</Label>
                            <Input value={formData.category || ''} placeholder="Infrastruktur, Tools..." className="bg-white" />
                          </TextField>
                          <TextField value={formData.icon || ''} onChange={(val) => setFormData({...formData, icon: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Icon (Emoji / URL)</Label>
                            <Input value={formData.icon || ''} placeholder="🏛️" className="bg-white" />
                          </TextField>
                        </div>

                        <TextField value={formData.description || ''} onChange={(val) => setFormData({...formData, description: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Kurzbeschreibung (Grid-Ansicht)</Label>
                          <TextArea value={formData.description || ''} placeholder="Maximal 150 Zeichen..." className="bg-white" />
                        </TextField>

                        <div className="grid grid-cols-2 gap-4">
                          <TextField value={Array.isArray(formData.techStack) ? formData.techStack.join(', ') : (formData.techStack as unknown as string || '')} onChange={(val) => setFormData({...formData, techStack: val.split(',').map(s => s.trim())})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Tech Stack</Label>
                            <Input value={Array.isArray(formData.techStack) ? formData.techStack.join(', ') : (formData.techStack as unknown as string || '')} placeholder="React, Go, PostgreSQL" className="bg-white" />
                          </TextField>
                          <TextField value={formData.license || ''} onChange={(val) => setFormData({...formData, license: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Lizenz</Label>
                            <Input value={formData.license || ''} placeholder="MIT, Apache 2.0" className="bg-white" />
                          </TextField>
                        </div>
                      </Tabs.Panel>

                      <Tabs.Panel id="technical" className="space-y-6">
                        <div className="p-4 bg-accent-50 rounded-xl border border-accent-100 flex gap-4 text-accent-700 mb-4">
                          <Layers className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm">Geben Sie hier die URLs für Deployments und Source-Code an.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <TextField value={formData.liveUrl || ''} onChange={(val) => setFormData({...formData, liveUrl: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Live URL</Label>
                            <Input value={formData.liveUrl || ''} placeholder="https://app.bund.de" className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={formData.repoUrl || ''} onChange={(val) => setFormData({...formData, repoUrl: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Github className="w-3 h-3" /> Repository URL</Label>
                            <Input value={formData.repoUrl || ''} placeholder="https://github.com/bund/app" className="bg-white font-mono text-sm" />
                          </TextField>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <TextField value={formData.dockerRepo || ''} onChange={(val) => setFormData({...formData, dockerRepo: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Docker Image</Label>
                            <Input value={formData.dockerRepo || ''} placeholder="ghcr.io/bund/image:latest" className="bg-white font-mono text-sm" />
                          </TextField>
                          <TextField value={formData.helmRepo || ''} onChange={(val) => setFormData({...formData, helmRepo: val})}>
                            <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Helm Chart</Label>
                            <Input value={formData.helmRepo || ''} placeholder="oci://ghcr.io/bund/charts/app" className="bg-white font-mono text-sm" />
                          </TextField>
                        </div>

                        <TextField value={formData.docsUrl || ''} onChange={(val) => setFormData({...formData, docsUrl: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Externe Dokumentation URL</Label>
                          <Input value={formData.docsUrl || ''} placeholder="https://docs.bund.de" className="bg-white font-mono text-sm" />
                        </TextField>
                      </Tabs.Panel>

                      <Tabs.Panel id="deployment" className="space-y-6">
                        <div className="p-4 bg-default-50 rounded-xl border border-default-200 flex gap-4 text-default-600 mb-4">
                          <Terminal className="w-5 h-5 flex-shrink-0" />
                          <p className="text-sm">Passen Sie die Deployment-Befehle an. Wenn leer, werden Standard-Befehle basierend auf den IDs und Repos generiert.</p>
                        </div>

                        <TextField value={formData.customDockerCommand || ''} onChange={(val) => setFormData({...formData, customDockerCommand: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Docker Command</Label>
                          <TextArea value={formData.customDockerCommand || ''} placeholder="docker run -d ..." className="bg-white font-mono text-sm" />
                        </TextField>
                        <TextField value={formData.customDockerNote || ''} onChange={(val) => setFormData({...formData, customDockerNote: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Docker Note</Label>
                          <Input value={formData.customDockerNote || ''} placeholder="Hinweis für Docker..." className="bg-white" />
                        </TextField>

                        <Separator className="my-2" />

                        <TextField value={formData.customComposeCommand || ''} onChange={(val) => setFormData({...formData, customComposeCommand: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Docker Compose</Label>
                          <TextArea value={formData.customComposeCommand || ''} placeholder="services: ..." className="bg-white font-mono text-sm" rows={5} />
                        </TextField>
                        <TextField value={formData.customComposeNote || ''} onChange={(val) => setFormData({...formData, customComposeNote: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Compose Note</Label>
                          <Input value={formData.customComposeNote || ''} placeholder="Hinweis für Compose..." className="bg-white" />
                        </TextField>

                        <Separator className="my-2" />

                        <TextField value={formData.customHelmCommand || ''} onChange={(val) => setFormData({...formData, customHelmCommand: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Custom Helm Command</Label>
                          <TextArea value={formData.customHelmCommand || ''} placeholder="helm install ..." className="bg-white font-mono text-sm" />
                        </TextField>
                        <TextField value={formData.customHelmNote || ''} onChange={(val) => setFormData({...formData, customHelmNote: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Helm Note</Label>
                          <Input value={formData.customHelmNote || ''} placeholder="Hinweis für Helm..." className="bg-white" />
                        </TextField>
                      </Tabs.Panel>

                      <Tabs.Panel id="docs" className="space-y-6 h-full flex flex-col">
                         <TextField className="flex-grow flex flex-col" value={formData.markdownContent || ''} onChange={(val) => setFormData({...formData, markdownContent: val})}>
                          <Label className="text-xs font-bold text-default-400 uppercase tracking-wider mb-1">Interne Dokumentation (Markdown)</Label>
                          <TextArea 
                            value={formData.markdownContent || ''}
                            placeholder="# Dokumentation\n\nBeschreiben Sie hier Details zur Installation..." 
                            className="bg-white font-mono text-sm h-[380px] w-full" 
                          />
                        </TextField>
                        <p className="text-[10px] text-default-400 italic">Nutzen Sie Markdown für Formatierungen, Code-Blöcke und Tabellen.</p>
                      </Tabs.Panel>
                    </div>
                  </Tabs>
                </Modal.Body>
                
                <Modal.Footer className="px-8 py-6 border-t border-default-200 bg-default-50/50 justify-end gap-3 sticky bottom-0">
                  <Button variant="secondary" onPress={() => setIsOpen(false)} className="font-bold">
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
    </div>
  );
}

export default function ManagementPage() {
  return (
    <Suspense fallback={<div className="p-8">Wird geladen...</div>}>
      <ManagementContent />
    </Suspense>
  );
}
