'use client';

import { AppConfig } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  Switch,
  Tabs,
  TextArea,
  TextField
} from '@heroui/react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Github,
  Globe,
  Info,
  Layers,
  Plus,
  Server,
  ShieldCheck,
  Terminal,
  Trash2
} from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApp: AppConfig | null;
  onSubmit: (formData: Partial<AppConfig>) => Promise<boolean>;
  initialData?: Partial<AppConfig>;
}

export function AppModal({
  isOpen,
  onOpenChange,
  selectedApp,
  onSubmit,
  initialData
}: AppModalProps) {
  const { user } = useAuth();
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>(initialData || {});
  const [iconInput, setIconInput] = useState(initialData?.icon || '');
  const [prevInitialData, setPrevInitialData] = useState<Partial<AppConfig> | undefined>(initialData);

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setAppFormData(initialData || {});
    setIconInput(initialData?.icon || '');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(appFormData);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-4xl">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <Modal.CloseTrigger />
              <Modal.Header className="px-8 py-6 border-b border-border bg-surface-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xl overflow-hidden shrink-0">
                    {appFormData.icon?.startsWith('http') ? (
                      <Image 
                        src={appFormData.icon} 
                        alt={appFormData.name || 'App Icon'} 
                        width={40} 
                        height={40}
                        className="w-full h-full object-contain p-1.5" 
                        unoptimized
                      />
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
                  <Tabs.ListContainer className="px-8 border-b border-border bg-surface sticky top-0 z-10 w-full overflow-x-auto">
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

                        {user?.role === 'admin' && (
                          <div className="flex items-center justify-between p-4 rounded-xl bg-accent/5 border border-accent/10">
                            <div className="flex flex-col gap-0.5">
                              <Label className="text-sm font-bold text-foreground">Ausgezeichnet (Empfehlung)</Label>
                              <p className="text-xs text-muted max-w-[400px]">Hervorgehobene Apps erscheinen mit einer speziellen Markierung im Store.</p>
                            </div>
                            <Switch 
                              isSelected={appFormData.isFeatured || false} 
                              onChange={(val) => setAppFormData({...appFormData, isFeatured: val})}
                            >
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch>
                          </div>
                        )}
                      </div>

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
                              const labs = [...(appFormData.liveDemos || [])];
                              labs.push({ label: 'Live Demo', url: '' });
                              setAppFormData({ ...appFormData, liveDemos: labs });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Hinzufügen
                          </Button>
                        </div>
                        {(appFormData.liveDemos || []).map((demo, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm group">
                            <div className="md:col-span-4">
                              <TextField onChange={(val) => {
                                const demos = [...(appFormData.liveDemos || [])];
                                demos[idx] = { ...demos[idx], label: val };
                                setAppFormData({ ...appFormData, liveDemos: demos });
                              }}>
                                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Label</Label>
                                <Input value={demo.label} placeholder="Produktion" className="bg-field-background" />
                              </TextField>
                            </div>
                            <div className="md:col-span-7">
                              <TextField onChange={(val) => {
                                const demos = [...(appFormData.liveDemos || [])];
                                demos[idx] = { ...demos[idx], url: val };
                                setAppFormData({ ...appFormData, liveDemos: demos });
                              }}>
                                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">URL</Label>
                                <Input value={demo.url} placeholder="https://..." className="bg-field-background font-mono text-sm" />
                              </TextField>
                            </div>
                            <Button size="sm" variant="secondary" className="md:col-span-1 h-10 w-10 p-0 text-danger" onPress={() => {
                              const demos = [...(appFormData.liveDemos || [])];
                              demos.splice(idx, 1);
                              setAppFormData({ ...appFormData, liveDemos: demos });
                            }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>

                      {/* Repositories */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div className="flex items-center gap-2">
                            <Github className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Repositories</Label>
                          </div>
                          <Button size="sm" variant="secondary" className="h-7 text-[10px] uppercase font-bold" onPress={() => {
                            const repositories = [...(appFormData.repositories || [])];
                            repositories.push({ label: 'Repository', url: '' });
                            setAppFormData({ ...appFormData, repositories });
                          }}><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
                        </div>
                        {(appFormData.repositories || []).map((repo, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border">
                            <div className="md:col-span-4">
                              <TextField onChange={(val) => {
                                const repos = [...(appFormData.repositories || [])];
                                repos[idx] = { ...repos[idx], label: val };
                                setAppFormData({ ...appFormData, repositories: repos });
                              }}><Label className="text-[10px] font-bold text-muted uppercase block mb-1">Label</Label><Input value={repo.label} className="bg-field-background" /></TextField>
                            </div>
                            <div className="md:col-span-7">
                              <TextField onChange={(val) => {
                                const repos = [...(appFormData.repositories || [])];
                                repos[idx] = { ...repos[idx], url: val };
                                setAppFormData({ ...appFormData, repositories: repos });
                              }}><Label className="text-[10px] font-bold text-muted uppercase block mb-1">URL</Label><Input value={repo.url} className="bg-field-background font-mono text-sm" /></TextField>
                            </div>
                            <Button size="sm" variant="secondary" className="md:col-span-1 h-10 w-10 p-0 text-danger" onPress={() => {
                              const repos = [...(appFormData.repositories || [])];
                              repos.splice(idx, 1);
                              setAppFormData({ ...appFormData, repositories: repos });
                            }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>

                      {/* Custom Links */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Custom Links</Label>
                          </div>
                          <Button size="sm" variant="secondary" className="h-7 text-[10px] uppercase font-bold" onPress={() => {
                            const links = [...(appFormData.customLinks || [])];
                            links.push({ label: 'Link', url: '' });
                            setAppFormData({ ...appFormData, customLinks: links });
                          }}><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
                        </div>
                        {(appFormData.customLinks || []).map((link, idx) => (
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border">
                            <div className="md:col-span-4">
                              <TextField onChange={(val) => {
                                const links = [...(appFormData.customLinks || [])];
                                links[idx] = { ...links[idx], label: val };
                                setAppFormData({ ...appFormData, customLinks: links });
                              }}><Label className="text-[10px] font-bold text-muted uppercase block mb-1">Label</Label><Input value={link.label} className="bg-field-background" /></TextField>
                            </div>
                            <div className="md:col-span-7">
                              <TextField onChange={(val) => {
                                const links = [...(appFormData.customLinks || [])];
                                links[idx] = { ...links[idx], url: val };
                                setAppFormData({ ...appFormData, customLinks: links });
                              }}><Label className="text-[10px] font-bold text-muted uppercase block mb-1">URL</Label><Input value={link.url} className="bg-field-background font-mono text-sm" /></TextField>
                            </div>
                            <Button size="sm" variant="secondary" className="md:col-span-1 h-10 w-10 p-0 text-danger" onPress={() => {
                              const links = [...(appFormData.customLinks || [])];
                              links.splice(idx, 1);
                              setAppFormData({ ...appFormData, customLinks: links });
                            }}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <Server className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Deployment & Docs</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({...appFormData, dockerRepo: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Docker Image</Label>
                            <Input value={appFormData.dockerRepo || ''} placeholder="image:latest" className="bg-field-background font-mono text-sm" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, helmRepo: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Helm Chart</Label>
                            <Input value={appFormData.helmRepo || ''} placeholder="oci://..." className="bg-field-background font-mono text-sm" />
                          </TextField>
                        </div>
                        <TextField onChange={(val) => setAppFormData({...appFormData, docsUrl: val})}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Externe Dokumentation URL</Label>
                          <Input value={appFormData.docsUrl || ''} placeholder="https://docs..." className="bg-field-background font-mono text-sm" />
                        </TextField>
                      </div>
                    </Tabs.Panel>

                    <Tabs.Panel id="functional" className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <Info className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Klassifizierung & Zielsetzung</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({...appFormData, focus: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Schwerpunkt</Label>
                            <Input value={appFormData.focus || ''} placeholder="z.B. Dokumentenmanagement" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, appType: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Typ</Label>
                            <Input value={appFormData.appType || ''} placeholder="z.B. Webapp-Frontend" className="bg-field-background" />
                          </TextField>
                        </div>
                        <TextField onChange={(val) => setAppFormData({...appFormData, useCase: val})}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Anwendungsfall</Label>
                          <TextArea value={appFormData.useCase || ''} placeholder="Beschreiben Sie hier den fachlichen Nutzen und die Zielgruppe..." className="bg-field-background" />
                        </TextField>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <Layers className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Architektur & Technik</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({...appFormData, visualization: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Visualisierung</Label>
                            <Input value={appFormData.visualization || ''} placeholder="z.B. Grafana / React" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, deployment: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Deployment</Label>
                            <Input value={appFormData.deployment || ''} placeholder="z.B. Kubernetes / OpenShift" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, infrastructure: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Infrastruktur</Label>
                            <Input value={appFormData.infrastructure || ''} placeholder="z.B. AWS / On-Premise" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, database: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Datenbasis</Label>
                            <Input value={appFormData.database || ''} placeholder="z.B. PostgreSQL / S3" className="bg-field-background" />
                          </TextField>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <ShieldCheck className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Organisation & Status</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">App Status</Label>
                            <Select 
                              value={['POC', 'MVP', 'Sandbox', 'In Erprobung', 'Etabliert'].includes(appFormData.status || '') ? appFormData.status : 'custom'}
                              onSelectionChange={(key) => {
                                if (key !== 'custom') setAppFormData({...appFormData, status: key as string});
                                else setAppFormData({...appFormData, status: ''});
                              }}
                              className="w-full"
                              placeholder="Status wählen..."
                            >
                              <Select.Trigger className="bg-field-background border-none h-10 px-3"><Select.Value /><Select.Indicator /></Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  <ListBox.Item id="POC" textValue="POC">POC (Machbarkeitsstudie)<ListBox.ItemIndicator /></ListBox.Item>
                                  <ListBox.Item id="MVP" textValue="MVP">MVP (Minimalprodukt)<ListBox.ItemIndicator /></ListBox.Item>
                                  <ListBox.Item id="Sandbox" textValue="Sandbox">Sandbox<ListBox.ItemIndicator /></ListBox.Item>
                                  <ListBox.Item id="In Erprobung" textValue="In Erprobung">In Erprobung (Incubating)<ListBox.ItemIndicator /></ListBox.Item>
                                  <ListBox.Item id="Etabliert" textValue="Etabliert">Etabliert (Graduated)<ListBox.ItemIndicator /></ListBox.Item>
                                  <ListBox.Item id="custom" textValue="Eigener Status...">Eigener Status...<ListBox.ItemIndicator /></ListBox.Item>
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          </div>
                          {(!['POC', 'MVP', 'Sandbox', 'In Erprobung', 'Etabliert'].includes(appFormData.status || '') || appFormData.status === 'custom') && (
                            <TextField onChange={(val) => setAppFormData({...appFormData, status: val})}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Eigener Status (Text)</Label>
                              <Input value={appFormData.status === 'custom' ? '' : appFormData.status || ''} placeholder="Status manuell eingeben..." className="bg-field-background" />
                            </TextField>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({...appFormData, authority: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Behörde</Label>
                            <Input value={appFormData.authority || ''} placeholder="z.B. BMI / ITZBund" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, contactPerson: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Ansprechpartner</Label>
                            <Input value={appFormData.contactPerson || ''} placeholder="Name oder Abteilung" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({...appFormData, transferability: val})}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Übertragbarkeit</Label>
                            <Input value={appFormData.transferability || ''} placeholder="z.B. Hoch (Standard-Komponenten)" className="bg-field-background" />
                          </TextField>
                        </div>
                        <TextField onChange={(val) => setAppFormData({...appFormData, additionalInfo: val})}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Sonstiges</Label>
                          <TextArea value={appFormData.additionalInfo || ''} placeholder="Weitere fachliche oder organisatorische Details..." className="bg-field-background" />
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
                          ><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                        </div>
                        {appFormData.hasDeploymentAssistant !== false && (
                          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border pt-4">
                            {(['Docker', 'Compose', 'Helm'] as const).map(type => (
                              <div key={type} className="flex flex-col gap-2 items-center">
                                <Label className="text-[10px] uppercase font-bold text-muted">{type}</Label>
                                <Switch 
                                  isSelected={appFormData[`show${type}` as keyof AppConfig] !== false} 
                                  onChange={(isSelected) => setAppFormData({...appFormData, [`show${type}`]: isSelected})}
                                ><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                              </div>
                            ))}
                          </div>
                        )}
                      </Surface>

                      {appFormData.hasDeploymentAssistant !== false && (
                        <div className="space-y-6">
                          {appFormData.showDocker !== false && (
                            <div className="space-y-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customDockerCommand: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Docker Command</Label>
                                <TextArea value={appFormData.customDockerCommand || ''} placeholder="docker run -d -p 8080:80 ..." className="bg-field-background font-mono text-sm" />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customDockerNote: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Docker Note</Label>
                                <Input value={appFormData.customDockerNote || ''} placeholder="z.B. Erfordert Docker 20.10+" className="bg-field-background" />
                              </TextField>
                            </div>
                          )}
                          {appFormData.showCompose !== false && (
                            <div className="space-y-4 border-t border-border pt-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customComposeCommand: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Compose Command</Label>
                                <TextArea value={appFormData.customComposeCommand || ''} placeholder="services:&#10;  app:&#10;    image: ..." className="bg-field-background font-mono text-sm" rows={5} />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customComposeNote: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Compose Note</Label>
                                <Input value={appFormData.customComposeNote || ''} placeholder="z.B. Benötigt .env Datei" className="bg-field-background" />
                              </TextField>
                            </div>
                          )}
                          {appFormData.showHelm !== false && (
                            <div className="space-y-4 border-t border-border pt-4">
                              <TextField onChange={(val) => setAppFormData({...appFormData, customHelmCommand: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Helm Command</Label>
                                <TextArea value={appFormData.customHelmCommand || ''} placeholder="helm upgrade --install my-app ..." className="bg-field-background font-mono text-sm" />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customHelmNote: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Helm Note</Label>
                                <Input value={appFormData.customHelmNote || ''} placeholder="z.B. Benötigt Cert-Manager" className="bg-field-background" />
                              </TextField>
                              <TextField onChange={(val) => setAppFormData({...appFormData, customHelmValues: val})}>
                                <Label className="text-xs font-bold text-muted block mb-1">Helm Values (YAML)</Label>
                                <TextArea value={appFormData.customHelmValues || ''} placeholder="replicaCount: 1&#10;image:&#10;  repository: ..." className="bg-field-background font-mono text-sm" rows={8} />
                              </TextField>
                            </div>
                          )}
                        </div>
                      )}
                    </Tabs.Panel>

                    <Tabs.Panel id="docs" className="h-full">
                      <TextField onChange={(val) => setAppFormData({...appFormData, markdownContent: val})} className="h-full">
                        <Label className="text-xs font-bold text-muted uppercase block mb-1">Dokumentation (Markdown)</Label>
                        <TextArea value={appFormData.markdownContent || ''} className="bg-field-background font-mono text-sm md:h-[400px]" />
                      </TextField>
                    </Tabs.Panel>
                  </div>
                </Tabs>
              </Modal.Body>
              
              <Modal.Footer className="px-8 py-6 border-t border-border bg-surface-secondary/50 justify-end gap-3 sticky bottom-0">
                <Button variant="secondary" onPress={() => onOpenChange(false)} className="font-bold">Abbrechen</Button>
                <Button type="submit" className="bg-accent text-white font-medium px-8">
                  {selectedApp ? 'Änderungen speichern' : 'App erstellen'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
