'use client';

import { AppConfig, AppField } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { uploadFile } from '@/lib/api';
import { getImageAssetUrl, isImageAssetSource } from '@/lib/assets';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  Switch,
  TextArea,
  TextField
} from '@heroui/react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Layers,
  Loader2,
  Plus,
  Server,
  Share2,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { GitHubIcon } from './GitHubIcon';

interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApp: AppConfig | null;
  onSubmit: (formData: Partial<AppConfig>) => Promise<boolean>;
  initialData?: Partial<AppConfig>;
  existingApps?: AppConfig[];
}

const PREDEFINED_CATEGORIES = [
  'Verwaltung',
  'Kommunikation',
  'Infrastruktur',
  'Sicherheit',
  'Datenanalyse',
  'Dokumentenmanagement',
  'Projektmanagement',
  'Bürgerdienste',
  'Geodaten',
  'Finanzen',
  'Personal',
  'Bildung',
  'Gesundheit',
  'Umwelt',
  'Verkehr',
  'KI & Automatisierung',
];

const ICON_OPTIONS = [
  { emoji: '🏛️', label: 'Verwaltung' },
  { emoji: '📊', label: 'Analyse' },
  { emoji: '💬', label: 'Kommunikation' },
  { emoji: '🔐', label: 'Sicherheit' },
  { emoji: '📅', label: 'Kalender' },
  { emoji: '🚀', label: 'Deployment' },
  { emoji: '🛠️', label: 'Tools' },
  { emoji: '📱', label: 'Mobile' },
  { emoji: '🛡️', label: 'Schutz' },
  { emoji: '⚙️', label: 'Einstellungen' },
  { emoji: '📦', label: 'Paket' },
  { emoji: '📈', label: 'Statistik' },
  { emoji: '🔑', label: 'Zugang' },
  { emoji: '🏙️', label: 'Stadt' },
  { emoji: '👥', label: 'Personen' },
  { emoji: '🗺️', label: 'Karte' },
  { emoji: '💰', label: 'Finanzen' },
  { emoji: '📝', label: 'Dokument' },
  { emoji: '🌐', label: 'Web' },
  { emoji: '🤖', label: 'KI' },
  { emoji: '📧', label: 'E-Mail' },
  { emoji: '🗂️', label: 'Ordner' },
  { emoji: '🔍', label: 'Suche' },
  { emoji: '🎓', label: 'Bildung' },
];

interface StepDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export function AppModal({
  isOpen,
  onOpenChange,
  selectedApp,
  onSubmit,
  initialData,
  existingApps = []
}: AppModalProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [appFormData, setAppFormData] = useState<Partial<AppConfig>>(initialData || {});
  const [iconInput, setIconInput] = useState(initialData?.icon || '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const iconSrc = getImageAssetUrl(appFormData.icon);

  const isIdTaken = !selectedApp && !!appFormData.id?.trim() && existingApps.some(a => a.id === appFormData.id?.trim());
  const [prevInitialData, setPrevInitialData] = useState<Partial<AppConfig> | undefined>(initialData);
  const [currentStep, setCurrentStep] = useState(0);
  const deploymentAssistantEnabled = appFormData.hasDeploymentAssistant ?? true;

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setAppFormData(initialData || {});
    setIconInput(initialData?.icon || '');
    setIconUploadError(null);
    setCurrentStep(0);
  }

  const steps: StepDef[] = [
    { id: 'basics', label: 'Grundlagen', icon: <Info className="w-4 h-4" /> },
    { id: 'type', label: 'Bereitstellung', icon: <Share2 className="w-4 h-4" /> },
    { id: 'links', label: 'Links & Ressourcen', icon: <Globe className="w-4 h-4" /> },
    { id: 'details', label: 'Details', icon: <Layers className="w-4 h-4" /> },
    { id: 'docs', label: 'Dokumentation', icon: <FileText className="w-4 h-4" /> },
  ];

  const canProceed = () => {
    if (currentStep === 0) {
      return !!(appFormData.name && appFormData.id && appFormData.categories?.length && !isIdTaken);
    }
    if (currentStep === 1 && appFormData.isReuse) {
      const hasValidDemo = appFormData.liveDemos?.some(d => d.url?.trim());
      return !!hasValidDemo;
    }
    return true;
  };

  const handleSubmit = async () => {
    const success = await onSubmit(appFormData);
    if (success) {
      onOpenChange(false);
      setCurrentStep(0);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) setCurrentStep(0); onOpenChange(open); }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-4xl p-0">
            <div className="flex flex-col h-full">
              <Modal.CloseTrigger />

              {/* ── Header with stepper ── */}
              <Modal.Header className="px-8 py-5 border-b border-border bg-surface-secondary/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xl overflow-hidden shrink-0">
                    {iconSrc ? (
                      <Image
                        src={iconSrc}
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
                      Schritt {currentStep + 1} von {steps.length} — {steps[currentStep].label}
                    </p>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-1">
                  {steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(idx)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          idx === currentStep
                            ? 'bg-accent text-white shadow-sm'
                            : idx < currentStep
                              ? 'bg-accent/10 text-accent hover:bg-accent/20'
                              : 'bg-surface-secondary text-muted hover:bg-surface-secondary/80'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx < currentStep ? 'bg-accent/20' : idx === currentStep ? 'bg-white/20' : 'bg-border'
                        }`}>
                          {idx < currentStep ? <Check className="w-3 h-3" /> : idx + 1}
                        </span>
                        <span className="hidden md:inline">{step.label}</span>
                      </button>
                      {idx < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 rounded-full min-w-4 ${idx < currentStep ? 'bg-accent/30' : 'bg-border'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </Modal.Header>

              {/* ── Body ── */}
              <Modal.Body className="p-0 overflow-hidden">
                <div className="overflow-y-auto px-8 py-8 md:h-[500px]">

                  {/* ═══ Step 1: Grundlagen ═══ */}
                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <Surface variant="default" className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex gap-3">
                        <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-sm text-muted">Geben Sie die grundlegenden Informationen zu Ihrer App an. Name, ID und Kategorie sind Pflichtfelder.</p>
                      </Surface>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField isRequired onChange={(val) => {
                          const newData = { ...appFormData, name: val };
                          if (!selectedApp) {
                            newData.id = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                          }
                          setAppFormData(newData);
                        }}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">App Name</Label>
                          <Input value={appFormData.name || ''} placeholder="z.B. Digi-Sign Pro" className="bg-field-background" />
                        </TextField>
                        <div>
                          <TextField
                            isRequired
                            onChange={(val) => setAppFormData({ ...appFormData, id: val.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            isDisabled={!!selectedApp}
                            isInvalid={isIdTaken}
                          >
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Eindeutige ID (URL)</Label>
                            <Input value={appFormData.id || ''} placeholder="z.B. digi-sign-pro" className="bg-field-background font-mono" />
                          </TextField>
                          {isIdTaken && (
                            <p className="text-xs text-danger mt-1 font-medium">Diese ID ist bereits vergeben. Bitte wählen Sie eine andere.</p>
                          )}
                          {!selectedApp && appFormData.id && !isIdTaken && (
                            <p className="text-xs text-success mt-1 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" /> ID ist verfügbar
                            </p>
                          )}
                        </div>
                      </div>

                      <TextField onChange={(val) => setAppFormData({ ...appFormData, description: val })}>
                        <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Kurzbeschreibung</Label>
                        <TextArea value={appFormData.description || ''} placeholder="Eine kurze Zusammenfassung für die Store-Übersicht" className="bg-field-background min-h-[80px]" />
                      </TextField>

                      {/* ── Kategorien mit vordefinierten Optionen ── */}
                      <div>
                        <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Kategorien *</Label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {PREDEFINED_CATEGORIES.map((cat) => {
                            const isSelected = appFormData.categories?.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  const current = appFormData.categories || [];
                                  const updated = isSelected
                                    ? current.filter(c => c !== cat)
                                    : [...current, cat];
                                  setAppFormData({ ...appFormData, categories: updated });
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                  isSelected
                                    ? 'bg-accent text-white border-accent shadow-sm'
                                    : 'bg-surface border-border text-muted hover:border-accent/30 hover:text-foreground'
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 items-end">
                          <TextField onChange={(val) => setCategoryInput(val)} className="flex-1">
                            <Label className="text-[10px] text-muted mb-0.5">Eigene Kategorie hinzufügen</Label>
                            <Input
                              value={categoryInput}
                              placeholder="z.B. Soziales, Justiz..."
                              className="bg-field-background h-9 text-sm"
                              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter' && categoryInput.trim()) {
                                  e.preventDefault();
                                  const current = appFormData.categories || [];
                                  if (!current.includes(categoryInput.trim())) {
                                    setAppFormData({ ...appFormData, categories: [...current, categoryInput.trim()] });
                                  }
                                  setCategoryInput('');
                                }
                              }}
                            />
                          </TextField>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 px-3 shrink-0"
                            isDisabled={!categoryInput.trim()}
                            onPress={() => {
                              const current = appFormData.categories || [];
                              if (!current.includes(categoryInput.trim())) {
                                setAppFormData({ ...appFormData, categories: [...current, categoryInput.trim()] });
                              }
                              setCategoryInput('');
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {appFormData.categories && appFormData.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
                            <span className="text-[10px] text-muted uppercase tracking-wider font-bold self-center mr-1">Gewählt:</span>
                            {appFormData.categories.map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                              >
                                {cat}
                                <button
                                  type="button"
                                  onClick={() => setAppFormData({ ...appFormData, categories: appFormData.categories?.filter(c => c !== cat) })}
                                  className="hover:text-danger transition-colors ml-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── Icon Auswahl ── */}
                      <div>
                        <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Icon</Label>
                        <div className="flex gap-4 items-start">
                          {/* Preview */}
                          <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border bg-surface-secondary flex items-center justify-center text-3xl shrink-0">
                            {iconSrc ? (
                              <Image
                                src={iconSrc}
                                alt="Icon"
                                width={48}
                                height={48}
                                className="object-contain"
                                unoptimized
                              />
                            ) : (
                              appFormData.icon || '🏛️'
                            )}
                          </div>
                          <div className="flex-1">
                            {/* Emoji grid */}
                            <div className={`grid grid-cols-8 gap-1.5 mb-3 transition-all p-0.5 -m-0.5 ${showIconPicker ? '' : 'max-h-[88px] overflow-hidden'}`}>
                              {ICON_OPTIONS.map(({ emoji, label }) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  title={label}
                                  onClick={() => {
                                    setAppFormData({ ...appFormData, icon: emoji });
                                    setIconInput(emoji);
                                  }}
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all border ${
                                    appFormData.icon === emoji
                                      ? 'bg-accent/10 border-accent shadow-sm scale-110'
                                      : 'bg-surface border-border hover:border-accent/30 hover:bg-surface-secondary'
                                  }`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            {ICON_OPTIONS.length > 16 && (
                              <button
                                type="button"
                                onClick={() => setShowIconPicker(!showIconPicker)}
                                className="text-[11px] text-accent font-medium hover:underline mb-2"
                              >
                                {showIconPicker ? 'Weniger anzeigen' : 'Alle anzeigen'}
                              </button>
                            )}
                            {/* Upload or custom URL */}
                            <div className="flex gap-2 items-center">
                              <TextField
                                className="flex-1"
                                onChange={(val) => {
                                  setIconInput(val);
                                  setAppFormData({ ...appFormData, icon: val });
                                  setIconUploadError(null);
                                }}
                              >
                                <Input
                                  value={isImageAssetSource(iconInput) ? iconInput : ''}
                                  placeholder="Bild-URL: https://..."
                                  className="bg-field-background h-8 text-xs"
                                />
                              </TextField>
                              <input
                                ref={iconFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingIcon(true);
                                  setIconUploadError(null);
                                  try {
                                    const url = await uploadFile('/upload/logo', file);
                                    setIconInput(url);
                                    setAppFormData({ ...appFormData, icon: url });
                                  } catch (err) {
                                    setIconUploadError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
                                  } finally {
                                    setUploadingIcon(false);
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1.5 h-8 shrink-0 text-xs"
                                isDisabled={uploadingIcon}
                                onPress={() => iconFileInputRef.current?.click()}
                              >
                                {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                {uploadingIcon ? 'Lädt...' : 'Upload'}
                              </Button>
                            </div>
                            {iconUploadError && (
                              <p className="text-[11px] text-danger mt-1">{iconUploadError}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {user?.role === 'admin' && (
                        <div className="flex items-center justify-between p-4 rounded-xl bg-accent/5 border border-accent/10">
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-sm font-bold text-foreground">Ausgezeichnet (Empfehlung)</Label>
                            <p className="text-xs text-muted max-w-[400px]">Hervorgehobene Apps erscheinen mit einer speziellen Markierung im Store.</p>
                          </div>
                          <Switch
                            isSelected={appFormData.isFeatured || false}
                            onChange={(val) => setAppFormData({ ...appFormData, isFeatured: val })}
                          >
                            <Switch.Control><Switch.Thumb /></Switch.Control>
                          </Switch>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ Step 2: Art der Bereitstellung ═══ */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <Surface variant="default" className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex gap-3">
                        <Share2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-sm text-muted">Wie soll Ihre App anderen zur Verfügung gestellt werden?</p>
                      </Surface>

                      {/* Type selection cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setAppFormData({ ...appFormData, hasDeploymentAssistant: !deploymentAssistantEnabled })}
                          className={`p-5 rounded-2xl border-2 text-left transition-all ${
                            deploymentAssistantEnabled
                              ? 'border-accent bg-accent/5 shadow-sm'
                              : 'border-border hover:border-accent/30 bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${deploymentAssistantEnabled ? 'bg-accent/10' : 'bg-surface-secondary'}`}>
                              <Terminal className={`w-5 h-5 ${deploymentAssistantEnabled ? 'text-accent' : 'text-muted'}`} />
                            </div>
                            <div>
                              <h3 className={`text-sm font-bold ${deploymentAssistantEnabled ? 'text-accent' : 'text-foreground'}`}>Selbst installieren</h3>
                              <p className="text-[11px] text-muted">Technische Anleitung für eigene Installation</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted leading-relaxed">
                            Aktivieren Sie den Deployment Assistant, wenn Docker-, Compose- oder Helm-Anleitungen für einen Eigenbetrieb bereitgestellt werden sollen.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAppFormData({ ...appFormData, isReuse: !appFormData.isReuse })}
                          className={`p-5 rounded-2xl border-2 text-left transition-all ${
                            appFormData.isReuse
                              ? 'border-warning bg-warning/5 shadow-sm'
                              : 'border-border hover:border-warning/30 bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${appFormData.isReuse ? 'bg-warning/10' : 'bg-surface-secondary'}`}>
                              <Share2 className={`w-5 h-5 ${appFormData.isReuse ? 'text-warning' : 'text-muted'}`} />
                            </div>
                            <div>
                              <h3 className={`text-sm font-bold ${appFormData.isReuse ? 'text-warning' : 'text-foreground'}`}>Nachnutzung</h3>
                              <p className="text-[11px] text-muted">Andere nutzen Ihre Installation mit</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted leading-relaxed">
                            Bieten Sie Ihre bestehende Installation zur Mitnutzung an. Diese Option kann zusätzlich zur Installationsanleitung aktiviert werden.
                          </p>
                        </button>
                      </div>

                      {appFormData.isReuse && (
                        <div className="space-y-6 pt-2">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                              <ExternalLink className="w-4 h-4 text-warning" />
                              <Label className="text-sm font-bold text-foreground">Link zur bestehenden Installation *</Label>
                            </div>
                            <p className="text-xs text-muted">Geben Sie mindestens einen Link zur bestehenden Installation an, über den andere die App erreichen können.</p>
                            {(appFormData.liveDemos || []).map((demo, idx) => (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm">
                                <div className="md:col-span-4">
                                  <TextField onChange={(val) => {
                                    const demos = [...(appFormData.liveDemos || [])];
                                    demos[idx] = { ...demos[idx], label: val };
                                    setAppFormData({ ...appFormData, liveDemos: demos });
                                  }}>
                                    <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Label</Label>
                                    <Input value={demo.label} placeholder="z.B. Produktionsumgebung" className="bg-field-background" />
                                  </TextField>
                                </div>
                                <div className="md:col-span-7">
                                  <TextField isRequired onChange={(val) => {
                                    const demos = [...(appFormData.liveDemos || [])];
                                    demos[idx] = { ...demos[idx], url: val };
                                    setAppFormData({ ...appFormData, liveDemos: demos });
                                  }}>
                                    <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">URL</Label>
                                    <Input value={demo.url} placeholder="https://..." className="bg-field-background font-mono text-sm" />
                                  </TextField>
                                </div>
                                {(appFormData.liveDemos || []).length > 1 && (
                                  <Button size="sm" variant="secondary" className="md:col-span-1 h-10 w-10 p-0 text-danger" onPress={() => {
                                    const demos = [...(appFormData.liveDemos || [])];
                                    demos.splice(idx, 1);
                                    setAppFormData({ ...appFormData, liveDemos: demos });
                                  }}><Trash2 className="w-4 h-4" /></Button>
                                )}
                              </div>
                            ))}
                            {(!appFormData.liveDemos || appFormData.liveDemos.length === 0) && (
                              <Button
                                variant="secondary"
                                className="w-full h-12 border-dashed border-2 text-sm font-medium"
                                onPress={() => setAppFormData({ ...appFormData, liveDemos: [{ label: 'Zur Anwendung', url: '' }] })}
                              >
                                <Plus className="w-4 h-4 mr-2" /> Link hinzufügen
                              </Button>
                            )}
                            {appFormData.liveDemos && appFormData.liveDemos.length > 0 && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-[10px] uppercase font-bold tracking-wider"
                                onPress={() => {
                                  const demos = [...(appFormData.liveDemos || [])];
                                  demos.push({ label: 'Weitere Umgebung', url: '' });
                                  setAppFormData({ ...appFormData, liveDemos: demos });
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Weiteren Link hinzufügen
                              </Button>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                              <Share2 className="w-4 h-4 text-warning" />
                              <Label className="text-sm font-bold text-foreground">Voraussetzungen</Label>
                            </div>
                            <TextField onChange={(val) => setAppFormData({ ...appFormData, reuseRequirements: val })}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Was wird zur Nachnutzung benötigt?</Label>
                              <TextArea
                                value={appFormData.reuseRequirements || ''}
                                placeholder="Beschreiben Sie, was zur Nachnutzung benötigt wird (z.B. Zugangsantrag, technische Anbindung, Nutzungsvereinbarung, Kosten...)"
                                className="bg-field-background min-h-[120px]"
                              />
                            </TextField>
                          </div>
                        </div>
                      )}

                      {deploymentAssistantEnabled && (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Terminal className="w-4 h-4 text-accent" />
                            <Label className="text-sm font-bold text-foreground">Deployment-Konfiguration</Label>
                          </div>

                          <Surface variant="default" className="p-4 bg-surface-secondary rounded-xl border border-border space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold">Deployment Assistant aktivieren</Label>
                              <Switch
                                isSelected={deploymentAssistantEnabled}
                                onChange={(isSelected) => setAppFormData({ ...appFormData, hasDeploymentAssistant: isSelected })}
                              ><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                            </div>
                            {deploymentAssistantEnabled && (
                              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
                                {(['Docker', 'Compose', 'Helm'] as const).map(type => (
                                  <div key={type} className="flex flex-col gap-2 items-center">
                                    <Label className="text-[10px] uppercase font-bold text-muted">{type}</Label>
                                    <Switch
                                      isSelected={appFormData[`show${type}` as keyof AppConfig] !== false}
                                      onChange={(isSelected) => setAppFormData({ ...appFormData, [`show${type}`]: isSelected })}
                                    ><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Surface>

                          {appFormData.hasDeploymentAssistant !== false && (
                            <div className="space-y-6">
                              {appFormData.showDocker !== false && (
                                <div className="space-y-3">
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customDockerCommand: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Docker Command</Label>
                                    <TextArea value={appFormData.customDockerCommand || ''} placeholder="docker run -d -p 8080:80 ..." className="bg-field-background font-mono text-sm" />
                                  </TextField>
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customDockerNote: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Docker Note</Label>
                                    <Input value={appFormData.customDockerNote || ''} placeholder="z.B. Erfordert Docker 20.10+" className="bg-field-background" />
                                  </TextField>
                                </div>
                              )}
                              {appFormData.showCompose !== false && (
                                <div className="space-y-3 border-t border-border pt-4">
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customComposeCommand: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Compose Command</Label>
                                    <TextArea value={appFormData.customComposeCommand || ''} placeholder="services:&#10;  app:&#10;    image: ..." className="bg-field-background font-mono text-sm" rows={5} />
                                  </TextField>
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customComposeNote: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Compose Note</Label>
                                    <Input value={appFormData.customComposeNote || ''} placeholder="z.B. Benötigt .env Datei" className="bg-field-background" />
                                  </TextField>
                                </div>
                              )}
                              {appFormData.showHelm !== false && (
                                <div className="space-y-3 border-t border-border pt-4">
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customHelmCommand: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Helm Command</Label>
                                    <TextArea value={appFormData.customHelmCommand || ''} placeholder="helm upgrade --install my-app ..." className="bg-field-background font-mono text-sm" />
                                  </TextField>
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customHelmNote: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Helm Note</Label>
                                    <Input value={appFormData.customHelmNote || ''} placeholder="z.B. Benötigt Cert-Manager" className="bg-field-background" />
                                  </TextField>
                                  <TextField onChange={(val) => setAppFormData({ ...appFormData, customHelmValues: val })}>
                                    <Label className="text-xs font-bold text-muted block mb-1">Helm Values (YAML)</Label>
                                    <TextArea value={appFormData.customHelmValues || ''} placeholder="replicaCount: 1&#10;image:&#10;  repository: ..." className="bg-field-background font-mono text-sm" rows={6} />
                                  </TextField>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ Step 3: Links & Ressourcen ═══ */}
                  {currentStep === 2 && (
                    <div className="space-y-8">
                      <Surface variant="default" className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex gap-3">
                        <Globe className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-sm text-muted">Verknüpfen Sie Demos, Repositories und weitere Ressourcen. Alle Felder sind optional.</p>
                      </Surface>

                      {/* Live Demos */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-muted" />
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
                          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-surface/50 p-3 rounded-xl border border-border shadow-sm">
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
                            <GitHubIcon className="w-4 h-4 text-muted" />
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
                            <Label className="text-sm font-bold text-foreground">Weitere Links</Label>
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

                      {/* Deployment refs & Docs */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <Server className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Artefakte & Dokumentation</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({ ...appFormData, dockerRepo: val })}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Docker Image</Label>
                            <Input value={appFormData.dockerRepo || ''} placeholder="image:latest" className="bg-field-background font-mono text-sm" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({ ...appFormData, helmRepo: val })}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Helm Chart</Label>
                            <Input value={appFormData.helmRepo || ''} placeholder="oci://..." className="bg-field-background font-mono text-sm" />
                          </TextField>
                        </div>
                        <TextField onChange={(val) => setAppFormData({ ...appFormData, docsUrl: val })}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Externe Dokumentation URL</Label>
                          <Input value={appFormData.docsUrl || ''} placeholder="https://docs..." className="bg-field-background font-mono text-sm" />
                        </TextField>
                      </div>
                    </div>
                  )}

                  {/* ═══ Step 4: Details ═══ */}
                  {currentStep === 3 && (
                    <div className="space-y-8">
                      <Surface variant="default" className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex gap-3">
                        <Layers className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-sm text-muted">Optionale fachliche und organisatorische Details. Diese Angaben helfen bei der Auffindbarkeit und Einordnung.</p>
                      </Surface>

                      {/* Tech Stack & License (always present) */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <Info className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Klassifizierung</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <TextField onChange={(val) => setAppFormData({ ...appFormData, techStack: val.split(',').map(s => s.trim()) })}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Tech Stack (Komma-separiert)</Label>
                            <Input value={Array.isArray(appFormData.techStack) ? appFormData.techStack.join(', ') : ''} placeholder="React, Go, PostgreSQL" className="bg-field-background" />
                          </TextField>
                          <TextField onChange={(val) => setAppFormData({ ...appFormData, license: val })}>
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Lizenz</Label>
                            <Input value={appFormData.license || ''} placeholder="MIT, Apache 2.0" className="bg-field-background" />
                          </TextField>
                        </div>
                      </div>

                      {/* Status (always present) */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <ShieldCheck className="w-4 h-4 text-muted" />
                          <Label className="text-sm font-bold text-foreground">Status</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">App Status</Label>
                            <Select
                              value={['POC', 'MVP', 'Sandbox', 'In Erprobung', 'Etabliert'].includes(appFormData.status || '') ? appFormData.status : 'custom'}
                              onSelectionChange={(key) => {
                                if (key !== 'custom') setAppFormData({ ...appFormData, status: key as string });
                                else setAppFormData({ ...appFormData, status: '' });
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
                            <TextField onChange={(val) => setAppFormData({ ...appFormData, status: val })}>
                              <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Eigener Status (Text)</Label>
                              <Input value={appFormData.status === 'custom' ? '' : appFormData.status || ''} placeholder="Status manuell eingeben..." className="bg-field-background" />
                            </TextField>
                          )}
                        </div>
                      </div>

                      {/* Dynamic custom fields from platform settings */}
                      {settings.detailFields && settings.detailFields.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-border pb-2">
                            <Layers className="w-4 h-4 text-muted" />
                            <Label className="text-sm font-bold text-foreground">Fachliche Details</Label>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {settings.detailFields.map(fieldDef => {
                              const currentValue = (appFormData.customFields ?? []).find(f => f.key === fieldDef.key)?.value ?? '';
                              const updateField = (val: string) => {
                                const fields: AppField[] = [...(appFormData.customFields ?? [])];
                                const idx = fields.findIndex(f => f.key === fieldDef.key);
                                if (val) {
                                  if (idx >= 0) fields[idx] = { key: fieldDef.key, value: val };
                                  else fields.push({ key: fieldDef.key, value: val });
                                } else {
                                  if (idx >= 0) fields.splice(idx, 1);
                                }
                                setAppFormData({ ...appFormData, customFields: fields });
                              };
                              return (
                                <TextField key={fieldDef.key} onChange={updateField}>
                                  <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">{fieldDef.label}</Label>
                                  <Input value={currentValue} placeholder={fieldDef.label} className="bg-field-background" />
                                </TextField>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Known Issue (always present) */}
                      <div className="space-y-4">
                        <TextField onChange={(val) => setAppFormData({ ...appFormData, knownIssue: val })}>
                          <Label className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Bekanntes Problem</Label>
                          <TextArea value={appFormData.knownIssue || ''} placeholder="z.B. Login derzeit nicht möglich. Fix wird vorbereitet..." className="bg-field-background" />
                        </TextField>
                      </div>
                    </div>
                  )}

                  {/* ═══ Step 5: Dokumentation ═══ */}
                  {currentStep === 4 && (
                    <div className="space-y-4 h-full">
                      <Surface variant="default" className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex gap-3">
                        <FileText className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                        <p className="text-sm text-muted">Verfassen Sie eine ausführliche Dokumentation im Markdown-Format. Diese wird auf der Detail-Seite der App angezeigt.</p>
                      </Surface>
                      <TextField onChange={(val) => setAppFormData({ ...appFormData, markdownContent: val })} className="h-full">
                        <Label className="text-xs font-bold text-muted uppercase block mb-1">Dokumentation (Markdown)</Label>
                        <TextArea value={appFormData.markdownContent || ''} className="bg-field-background font-mono text-sm md:h-[380px]" />
                      </TextField>
                    </div>
                  )}

                </div>
              </Modal.Body>

              {/* ── Footer with navigation ── */}
              <Modal.Footer className="px-8 py-5 border-t border-border bg-surface-secondary/50 justify-between sticky bottom-0">
                <div>
                  {currentStep > 0 && (
                    <Button
                      onPress={() => setCurrentStep(currentStep - 1)}
                      className="font-semibold gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Zurück
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onPress={() => { onOpenChange(false); setCurrentStep(0); }} className="font-bold">
                    Abbrechen
                  </Button>
                  {currentStep < steps.length - 1 ? (
                    <Button
                      onPress={() => setCurrentStep(currentStep + 1)}
                      isDisabled={!canProceed()}
                      className="bg-accent text-white font-medium px-6 gap-1.5"
                    >
                      Weiter
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button onPress={handleSubmit} className="bg-accent text-white font-medium px-8">
                      {selectedApp ? 'Änderungen speichern' : 'App erstellen'}
                    </Button>
                  )}
                </div>
              </Modal.Footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
