'use client';

import {
  Button,
  Input,
  Label,
  Modal,
  TextArea,
  TextField
} from '@heroui/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchApi } from '../../lib/api';

interface AppConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  liveUrl?: string;
  repoUrl?: string;
  helmRepo?: string;
  dockerRepo?: string;
  docsUrl?: string;
  icon?: string;
  techStack?: string[];
  license?: string;
  markdownContent?: string;
}

export default function ManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
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
      icon: '',
      techStack: [],
      license: '',
      markdownContent: ''
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      await fetchApi(`/apps/${id}`, { method: 'DELETE' });
      loadApps();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = selectedApp ? 'PUT' : 'POST';
    const url = selectedApp ? `/apps/${selectedApp.id}` : '/apps';
    
    // Convert techStack string to array if it's a string
    const finalData = {
      ...formData,
      techStack: typeof formData.techStack === 'string' 
        ? (formData.techStack as string).split(',').map(s => s.trim()) 
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

  if (authLoading || loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-bund-black">App Management</h1>
        <Button onPress={handleCreate} className="bg-bund-blue text-white">
          Neue App hinzufügen
        </Button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-bund-gray shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-default-50 border-b border-bund-gray">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-default-500">Name</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-default-500">Kategorie</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-default-500">ID</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-default-500">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bund-gray">
            {apps.map((app) => (
              <tr key={app.id} className="hover:bg-default-50 transition-colors">
                <td className="px-6 py-4 font-medium text-bund-black">{app.name}</td>
                <td className="px-6 py-4 text-default-600">{app.category}</td>
                <td className="px-6 py-4 text-default-600 font-mono text-sm">{app.id}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-default-100 text-default-700 hover:bg-default-200" onPress={() => handleEdit(app)}>
                      Bearbeiten
                    </Button>
                    <Button size="sm" className="bg-danger-50 text-danger hover:bg-danger-100" onPress={() => handleDelete(app.id)}>
                      Löschen
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-3xl">
              <form onSubmit={handleSubmit} className="flex flex-col">
                <Modal.CloseTrigger />
                <Modal.Header className="p-6 border-b border-bund-gray">
                  <h2 className="text-xl font-bold text-bund-black">{selectedApp ? 'App bearbeiten' : 'Neue App'}</h2>
                </Modal.Header>
                <Modal.Body className="gap-6 p-6">
                  <div className="flex gap-4">
                    <TextField isRequired className="flex-1" value={formData.id || ''} onChange={(val) => setFormData({...formData, id: val})} isDisabled={!!selectedApp}>
                      <Label className="text-sm font-medium text-default-700 mb-1">ID</Label>
                      <Input placeholder="e.g. my-app" />
                    </TextField>
                    <TextField isRequired className="flex-1" value={formData.name || ''} onChange={(val) => setFormData({...formData, name: val})}>
                      <Label className="text-sm font-medium text-default-700 mb-1">Name</Label>
                      <Input placeholder="App Name" />
                    </TextField>
                  </div>
                  <div className="flex gap-4">
                    <TextField className="flex-1" value={formData.category || ''} onChange={(val) => setFormData({...formData, category: val})}>
                      <Label className="text-sm font-medium text-default-700 mb-1">Kategorie</Label>
                      <Input placeholder="Verwaltung, Infrastruktur, etc." />
                    </TextField>
                    <TextField className="flex-1" value={formData.icon || ''} onChange={(val) => setFormData({...formData, icon: val})}>
                      <Label className="text-sm font-medium text-default-700 mb-1">Icon (Emoji or URL)</Label>
                      <Input placeholder="🚀" />
                    </TextField>
                  </div>
                  <TextField className="w-full" value={formData.description || ''} onChange={(val) => setFormData({...formData, description: val})}>
                    <Label className="text-sm font-medium text-default-700 mb-1">Beschreibung</Label>
                    <TextArea />
                  </TextField>
                  <TextField className="w-full" value={Array.isArray(formData.techStack) ? formData.techStack.join(', ') : (formData.techStack as unknown as string || '')} onChange={(val) => setFormData({...formData, techStack: val.split(',').map(s => s.trim())})}>
                    <Label className="text-sm font-medium text-default-700 mb-1">Tech Stack (kommagetrennt)</Label>
                    <Input placeholder="React, Go, PostgreSQL" />
                  </TextField>
                  <div className="flex gap-4">
                    <TextField className="flex-1" value={formData.dockerRepo || ''} onChange={(val) => setFormData({...formData, dockerRepo: val})}>
                      <Label className="text-sm font-medium text-default-700 mb-1">Docker Repo</Label>
                      <Input />
                    </TextField>
                    <TextField className="flex-1" value={formData.helmRepo || ''} onChange={(val) => setFormData({...formData, helmRepo: val})}>
                      <Label className="text-sm font-medium text-default-700 mb-1">Helm Repo</Label>
                      <Input />
                    </TextField>
                  </div>
                  <TextField className="w-full" value={formData.markdownContent || ''} onChange={(val) => setFormData({...formData, markdownContent: val})}>
                    <Label className="text-sm font-medium text-default-700 mb-1">Markdown Dokumentation</Label>
                    <TextArea rows={6} />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="p-6 border-t border-bund-gray justify-end gap-2">
                  <Button className="bg-default-100 text-default-700 hover:bg-default-200" onPress={() => setIsOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" className="bg-bund-blue text-white hover:bg-bund-blue/90">
                    Speichern
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
