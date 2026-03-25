'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AppConfig, AppField } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { fetchApi, uploadFile } from '@/lib/api';
import { DRAFT_STATUS, getAppStatusLabel, isDraftStatus } from '@/lib/appStatus';
import { resolveIcon } from '@/lib/detailFieldIcons';
import {
  Chip,
  Input,
  Label,
  Switch,
  Tabs,
  TextArea,
  TextField, toast
} from '@heroui/react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Github,
  Grip,
  Layers,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Scale,
  Server,
  Share2,
  Star,
  Terminal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const PREDEFINED_CATEGORIES = [
  'Verwaltung', 'Kommunikation', 'Infrastruktur', 'Sicherheit', 'Datenanalyse',
  'Dokumentenmanagement', 'Projektmanagement', 'Bürgerdienste', 'Geodaten',
  'Finanzen', 'Personal', 'Bildung', 'Gesundheit', 'Umwelt', 'Verkehr', 'KI & Automatisierung',
];

const ICON_OPTIONS = [
  { emoji: '🏛️', label: 'Verwaltung' }, { emoji: '📊', label: 'Analyse' },
  { emoji: '💬', label: 'Kommunikation' }, { emoji: '🔐', label: 'Sicherheit' },
  { emoji: '📅', label: 'Kalender' }, { emoji: '🚀', label: 'Deployment' },
  { emoji: '🛠️', label: 'Tools' }, { emoji: '📱', label: 'Mobile' },
  { emoji: '🛡️', label: 'Schutz' }, { emoji: '⚙️', label: 'Einstellungen' },
  { emoji: '📦', label: 'Paket' }, { emoji: '📈', label: 'Statistik' },
  { emoji: '🔑', label: 'Zugang' }, { emoji: '🏙️', label: 'Stadt' },
  { emoji: '👥', label: 'Personen' }, { emoji: '🗺️', label: 'Karte' },
  { emoji: '💰', label: 'Finanzen' }, { emoji: '📝', label: 'Dokument' },
  { emoji: '🌐', label: 'Web' }, { emoji: '🤖', label: 'KI' },
  { emoji: '📧', label: 'E-Mail' }, { emoji: '🗂️', label: 'Ordner' },
  { emoji: '🔍', label: 'Suche' }, { emoji: '🎓', label: 'Bildung' },
];

const PREDEFINED_STATUSES = [DRAFT_STATUS, 'POC', 'MVP', 'Sandbox', 'In Erprobung', 'Etabliert'];

// ── LinkListEditor ────────────────────────────────────────────────────────────

function LinkListEditor({
  title, icon, items, onChange, addLabel, placeholderLabel, placeholderUrl,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; url: string }[];
  onChange: (items: { label: string; url: string }[]) => void;
  addLabel: string;
  placeholderLabel: string;
  placeholderUrl: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-muted uppercase tracking-wider">{title}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange([...items, { label: placeholderLabel, url: '' }])}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-accent hover:bg-accent/10 transition-colors"
        >
          <Plus className="w-3 h-3" />{addLabel}
        </button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <TextField onChange={(val) => { const f = [...items]; f[idx] = { ...f[idx], label: val }; onChange(f); }}>
              <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bezeichnung</Label>
              <Input value={item.label} placeholder={placeholderLabel} className="bg-field-background h-8 text-sm" />
            </TextField>
          </div>
          <div className="col-span-7">
            <TextField onChange={(val) => { const f = [...items]; f[idx] = { ...f[idx], url: val }; onChange(f); }}>
              <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Adresse</Label>
              <Input value={item.url} placeholder={placeholderUrl} className="bg-field-background h-8 font-mono text-sm" />
            </TextField>
          </div>
          <button
            type="button"
            onClick={() => { const f = [...items]; f.splice(idx, 1); onChange(f); }}
            className="col-span-1 h-8 w-8 flex items-center justify-center rounded-lg text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── AppEditorForm ─────────────────────────────────────────────────────────────

interface AppEditorFormProps {
  initialApp: AppConfig | null;
  existingApps: AppConfig[];
}

export function AppEditorForm({ initialApp, existingApps }: AppEditorFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useSettings();

  const isNew = !initialApp;
  const isAdmin = user?.role === 'admin';
  const backUrl = isAdmin ? '/verwaltung/apps' : '/meine-apps';

  // ── Form data ──
  const [formData, setFormData] = useState<Partial<AppConfig>>(() =>
    initialApp ?? {
      categories: [],
      techStack: [],
      liveDemos: [],
      repositories: [],
      customLinks: [],
      icon: '🏛️',
      hasDeploymentAssistant: true,
      showDocker: true,
      showCompose: true,
      showHelm: true,
      license: 'MIT',
      status: DRAFT_STATUS,
    }
  );

  // ── Icon state ──
  const [iconUrlInput, setIconUrlInput] = useState(
    initialApp?.icon?.startsWith('http') ? initialApp.icon : ''
  );
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [techInput, setTechInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(isNew);
  const [editorMode, setEditorMode] = useState<'basic' | 'advanced'>(isNew ? 'basic' : 'advanced');
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // ── Related apps (editing only) ──
  const [relatedApps, setRelatedApps] = useState<{ id: string; name: string; icon?: string }[]>(
    initialApp?.relatedApps || []
  );
  const [relatedSearch, setRelatedSearch] = useState('');
  const [addingRelated, setAddingRelated] = useState(false);

  // ── Groups (admin + editing only) ──
  const [groups, setGroups] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [appGroupIds, setAppGroupIds] = useState<Set<string>>(
    new Set((initialApp?.appGroups || []).map((g) => g.id))
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const initialSnapshotRef = useRef('');
  const skipUnsavedWarningRef = useRef(false);

  const isIdTaken =
    isNew && !!formData.id?.trim() && existingApps.some((a) => a.id === formData.id?.trim());

  // Load groups
  useEffect(() => {
    if (!isNew && isAdmin) {
      fetchApi('/app-groups')
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setGroups(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isNew, isAdmin]);

  // ── Helpers ──
  const sanitizeLinks = (links: { label?: string; url?: string }[] | undefined) =>
    (links || []).filter((l) => l.url?.trim()).map((l) => ({ label: l.label || 'Link', url: l.url! }));

  const repositories = formData.repositories && formData.repositories.length > 0
    ? formData.repositories
    : [];
  const customLinks = formData.customLinks || [];
  const liveDemos = formData.liveDemos && formData.liveDemos.length > 0
    ? formData.liveDemos
    : [];

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/apps' : `/apps/${initialApp!.id}`;
      const body: Partial<AppConfig> = {
        ...formData,
        categories: Array.isArray(formData.categories) ? formData.categories : [],
        techStack: Array.isArray(formData.techStack) ? formData.techStack : [],
        repositories: sanitizeLinks(formData.repositories) as AppConfig['repositories'],
        customLinks: sanitizeLinks(formData.customLinks) as AppConfig['customLinks'],
        liveDemos: (formData.liveDemos || []).filter((d) => d.url?.trim()),
        status: formData.status?.trim() || (isNew ? DRAFT_STATUS : formData.status),
      };
      const res = await fetchApi(url, { method, body: JSON.stringify(body) });
      if (res.ok) {
        initialSnapshotRef.current = createSnapshot();
        skipUnsavedWarningRef.current = true;
        setSaveSuccess(true);
        toast.success(
          isDraft
            ? (isNew ? 'Der Entwurf wurde angelegt.' : 'Der Entwurf wurde gespeichert.')
            : 'Die Änderungen wurden gespeichert.'
        );
        setTimeout(() => router.push(backUrl), 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveError((err as { message?: string }).message || 'Speichern fehlgeschlagen');
        toast.danger((err as { message?: string }).message || 'Speichern fehlgeschlagen');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler');
      toast.danger(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRelated = async (app: AppConfig) => {
    if (!initialApp) return;
    setAddingRelated(true);
    try {
      const res = await fetchApi(`/apps/${initialApp.id}/related`, {
        method: 'POST',
        body: JSON.stringify({ relatedAppId: app.id }),
      });
      if (res.ok) {
        setRelatedApps((prev) => [...prev, { id: app.id, name: app.name, icon: app.icon }]);
        setRelatedSearch('');
      }
    } finally {
      setAddingRelated(false);
    }
  };

  const handleRemoveRelated = async (relatedId: string) => {
    if (!initialApp) return;
    await fetchApi(`/apps/${initialApp.id}/related/${relatedId}`, { method: 'DELETE' });
    setRelatedApps((prev) => prev.filter((a) => a.id !== relatedId));
  };

  const handleToggleGroup = async (groupId: string) => {
    if (!initialApp) return;
    const inGroup = appGroupIds.has(groupId);
    if (inGroup) {
      await fetchApi(`/app-groups/${groupId}/members/${initialApp.id}`, { method: 'DELETE' });
      setAppGroupIds((prev) => { const s = new Set(prev); s.delete(groupId); return s; });
    } else {
      await fetchApi(`/app-groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ appId: initialApp.id }),
      });
      setAppGroupIds((prev) => new Set([...prev, groupId]));
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const res = await fetchApi('/app-groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (res.ok) {
        const group = await res.json();
        setGroups((prev) => [...prev, group]);
        setNewGroupName('');
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredRelatable = existingApps.filter(
    (a) =>
      a.id !== (initialApp?.id || formData.id) &&
      !relatedApps.some((r) => r.id === a.id) &&
      (a.name.toLowerCase().includes(relatedSearch.toLowerCase()) ||
        a.id.toLowerCase().includes(relatedSearch.toLowerCase()))
  );

  const isDraft = isDraftStatus(formData.status || (isNew ? DRAFT_STATUS : undefined));
  const requiresExpandedDetails = !!formData.status?.trim() && !isDraft;
  const draftRequiredItems = [
    { label: 'Name', done: !!formData.name?.trim() },
    { label: 'ID', done: !!formData.id?.trim() && !isIdTaken },
  ];
  const rolloutItems = [
    { label: 'Kategorie', done: (formData.categories?.length ?? 0) > 0 },
    { label: 'Kurzbeschreibung', done: !!formData.description?.trim() },
  ];
  const requiredItems = [...draftRequiredItems, ...rolloutItems];
  const canSave = draftRequiredItems.every((item) => item.done) && (!requiresExpandedDetails || rolloutItems.every((item) => item.done));
  const requiredDoneCount = requiredItems.filter((item) => item.done).length;

  /* Build metadata for Fachliche Details tab */
  const fieldValueMap = new Map((formData.customFields ?? []).map(f => [f.key, f.value]));
  const metaFields = (settings.detailFields ?? [])
    .map(def => ({ key: def.key, label: def.label, value: fieldValueMap.get(def.key) || '', icon: resolveIcon(def.icon) }));

  const createSnapshot = () => JSON.stringify({
    appGroupIds: Array.from(appGroupIds).sort(),
    formData: {
      ...formData,
      categories: [...(formData.categories || [])],
      customFields: [...(formData.customFields || [])],
      customLinks: sanitizeLinks(formData.customLinks),
      liveDemos: sanitizeLinks(formData.liveDemos),
      repositories: sanitizeLinks(formData.repositories),
      tags: [...(formData.tags || [])],
      techStack: [...(formData.techStack || [])],
    },
    relatedApps: relatedApps.map((app) => app.id).sort(),
  });

  const hasUnsavedChanges = createSnapshot() !== initialSnapshotRef.current;

  useEffect(() => {
    initialSnapshotRef.current = createSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipUnsavedWarningRef.current || !hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const requestNavigation = (path: string) => {
    if (saving) return;
    if (!skipUnsavedWarningRef.current && hasUnsavedChanges) {
      setPendingNavigation(path);
      return;
    }
    router.push(path);
  };

  const confirmNavigation = () => {
    if (!pendingNavigation) return;
    skipUnsavedWarningRef.current = true;
    router.push(pendingNavigation);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — mirrors /apps/[id] detail page layout exactly
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto pb-20">

      {isNew && (
        <section className="mb-6 rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted/80">Neue App anlegen</p>
              <h2 className="text-xl font-bold text-foreground">Starten Sie mit einem Entwurf und ergänzen Sie technische Details später.</h2>
              <p className="text-sm text-muted">
                Für den ersten Entwurf reichen Name und ID. Sobald die App einen fachlichen Status erhält, sollten Kategorie und Kurzbeschreibung ergänzt werden.
              </p>
            </div>

            <div className="flex rounded-2xl border border-border bg-surface-secondary p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setEditorMode('basic')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${editorMode === 'basic' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
              >
                Basisdaten
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('advanced')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${editorMode === 'advanced' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
              >
                Erweiterte Angaben
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {requiredItems.map((item) => (
              <div key={item.label} className={`rounded-2xl border px-4 py-3 text-sm ${item.done ? 'border-success/30 bg-success/10 text-foreground' : 'border-border bg-surface-secondary/50 text-muted'}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {item.done ? <Check className="w-4 h-4 text-success" /> : <div className="h-4 w-4 rounded-full border border-border" />}
                  {item.label}
                </div>
                <p className="mt-1 text-xs">{item.done ? 'Erledigt' : item.label === 'Kategorie' || item.label === 'Kurzbeschreibung' ? 'Für sichtbare App empfohlen' : 'Noch offen'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Nav row (matches detail page) ── */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => requestNavigation(backUrl)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-all shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-sm">
            <button
              onClick={() => requestNavigation(backUrl)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            >
              Abbrechen
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Speichert...' : isDraft ? (isNew ? 'Entwurf speichern' : 'Entwurf sichern') : (isNew ? 'App speichern' : 'Speichern')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Known issue banner (editable, matches detail page position) ── */}
      {formData.knownIssue ? (
        <div className="mb-4 px-4 py-3 rounded-xl border bg-warning/10 border-warning/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2 text-warning">Bekanntes Problem</p>
            <input
              className="w-full bg-white/40 dark:bg-white/5 border border-warning/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-warning transition-colors"
              placeholder="Beschreibung eingeben..."
              value={formData.knownIssue}
              onChange={(e) => setFormData((p) => ({ ...p, knownIssue: e.target.value }))}
            />
          </div>
          <button
            type="button"
            onClick={() => setFormData((p) => ({ ...p, knownIssue: '' }))}
            className="shrink-0 text-warning/60 hover:text-warning transition-colors"
            title="Bekanntes Problem entfernen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFormData((p) => ({ ...p, knownIssue: ' ' }))}
          className="mb-4 w-full px-4 py-2.5 rounded-xl border border-dashed border-border/60 text-left flex items-center gap-2 text-xs text-muted/60 hover:text-muted hover:border-border transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Bekanntes Problem hinzufügen (optional)
        </button>
      )}

      {/* ── Hero (editable, identical layout to detail page) ── */}
      <header className="relative overflow-hidden rounded-3xl bg-surface-secondary border border-border p-6 md:p-8 mb-8">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-full h-full max-w-2xl pointer-events-none opacity-30 dark:opacity-20">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[80%] rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-8">
          {/* Icon (clickable picker) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowIconPicker((v) => !v)}
              className="relative w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-surface border-2 border-dashed border-accent/40 hover:border-accent shadow-sm flex items-center justify-center text-4xl md:text-6xl overflow-hidden group transition-all"
            >
              {formData.icon?.startsWith('http') ? (
                <Image src={formData.icon} alt="Icon" fill className="object-contain p-2" sizes="(max-width: 768px) 80px, 112px" unoptimized />
              ) : (
                formData.icon || '🏛️'
              )}
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
            </button>
            <button
              type="button"
              title="Bild hochladen"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent rounded-full flex items-center justify-center shadow-md hover:bg-accent/90 transition-colors"
              onClick={() => iconFileInputRef.current?.click()}
            >
              {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Upload className="w-3.5 h-3.5 text-white" />}
            </button>
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
                  setFormData((p) => ({ ...p, icon: url }));
                  setIconUrlInput(url);
                } catch {
                  setIconUploadError('Upload fehlgeschlagen');
                } finally {
                  setUploadingIcon(false);
                  e.target.value = '';
                }
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Required field note */}
            <p className="text-[10px] font-bold text-muted/60 uppercase tracking-wider mb-2 select-none">
              Entwurf: Name &amp; ID <span className="text-danger font-normal normal-case">* Pflichtfelder</span>
            </p>

            {/* Title row: name + category chips + status chip + reuse chip */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                className="bg-transparent text-2xl md:text-3xl font-extrabold text-foreground outline-none border-b-2 border-accent/20 hover:border-accent/50 focus:border-accent transition-colors pb-1 placeholder:text-muted/40 min-w-[200px] flex-shrink"
                placeholder="App Name..."
                value={formData.name || ''}
                onChange={(e) => {
                  const n = e.target.value;
                  setFormData((p) => ({
                    ...p,
                    name: n,
                    ...(isNew ? { id: n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {}),
                  }));
                }}
              />
              {(formData.categories || []).map(cat => (
                <Chip key={cat} size="sm" variant="soft" color="accent" className="text-[11px] uppercase font-bold tracking-wider group/chip">
                  {cat}
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, categories: p.categories?.filter((c) => c !== cat) }))}
                    className="ml-1 opacity-60 hover:opacity-100 group-hover/chip:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Chip>
              ))}
              {/* Add category button */}
              <button
                type="button"
                onClick={() => setShowCategoryPicker(v => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border border-dashed border-accent/40 text-accent hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-3 h-3" /> Kategorie *
              </button>
              {formData.isReuse && (
                <Chip size="sm" variant="soft" color="warning" className="text-[11px] uppercase font-bold flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  Nachnutzung
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, isReuse: false }))}
                    className="ml-1 opacity-60 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Chip>
              )}
            </div>

            {/* Status row — always-visible option buttons */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-bold text-muted/60 uppercase tracking-wider shrink-0">Status</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PREDEFINED_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, status: s }))}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                      (formData.status || (isNew ? DRAFT_STATUS : '')) === s
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-transparent border-border text-muted hover:border-accent/40 hover:text-foreground'
                    }`}
                  >
                    {getAppStatusLabel(s) || s}
                  </button>
                ))}
                {formData.status && !PREDEFINED_STATUSES.includes(formData.status) && (
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, status: '' }))}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-accent text-white border border-accent shadow-sm"
                  >
                    {formData.status}
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* ID field (new only) */}
            {isNew && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted font-mono shrink-0">ID:</span>
                <input
                  className={`flex-1 bg-transparent text-xs font-mono outline-none border-b border-transparent hover:border-accent/30 focus:border-accent transition-colors ${isIdTaken ? 'text-danger' : 'text-muted'}`}
                  value={formData.id || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                />
                {isIdTaken && <span className="text-xs text-danger font-medium shrink-0">⚠ Bereits vergeben</span>}
                {!isIdTaken && formData.id && (
                  <span className="text-xs text-success font-medium flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3" /> Verfügbar
                  </span>
                )}
              </div>
            )}
            {isNew && (
              <p className="text-[11px] text-muted/60 mb-3 -mt-1">
                Die ID ist die eindeutige Adresse der App und wird automatisch aus dem Namen generiert.
              </p>
            )}

            {/* Description (matches detail page position) */}
            <label className="block text-[10px] font-bold text-muted/60 uppercase tracking-wider mb-1.5 select-none">Kurzbeschreibung</label>
            <textarea
              className="w-full bg-transparent text-base md:text-md text-muted leading-relaxed outline-none border-b border-accent/15 hover:border-accent/30 focus:border-accent transition-colors pb-1 resize-none placeholder:text-muted/40 max-w-3xl mb-5"
              placeholder="Kurzbeschreibung eingeben..."
              value={formData.description || ''}
              rows={2}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            />

            {/* Tags (matches detail page position) */}
            <div className="mb-6">
              <label className="block text-[10px] font-bold text-muted/60 uppercase tracking-wider mb-2 select-none">Schlagwörter</label>
              <div className="flex flex-wrap gap-2 items-center">
                {(formData.tags || []).map(tag => (
                  <Chip key={tag} size="sm" variant="soft" className="text-xs font-medium bg-surface/50 border-border/60 group/tag">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))}
                      className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Chip>
                ))}
                <div className="flex items-center gap-1 border border-dashed border-border/60 rounded-full px-2 py-1 hover:border-accent/40 transition-colors focus-within:border-accent">
                  <input
                    className="bg-transparent text-xs outline-none placeholder:text-muted/40 min-w-[90px]"
                    placeholder="Tag eingeben..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                        e.preventDefault();
                        const tags = formData.tags || [];
                        if (!tags.includes(tagInput.trim())) {
                          setFormData(p => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
                        }
                        setTagInput('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (tagInput.trim()) {
                        const tags = formData.tags || [];
                        if (!tags.includes(tagInput.trim())) {
                          setFormData(p => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
                        }
                        setTagInput('');
                      }
                    }}
                    disabled={!tagInput.trim()}
                    className="text-accent hover:bg-accent/10 rounded-full transition-colors disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick links (matches detail page position and style exactly) */}
            <div className="flex items-center gap-3 flex-wrap">
              {liveDemos.map((demo, idx) => (
                <span key={`demo-${idx}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold shadow-sm">
                  <ExternalLink className="w-4 h-4" />
                  {demo.label || 'Live-Zugang'}
                </span>
              ))}
              {repositories.map((repo, idx) => (
                <span key={`repo-${idx}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground shadow-sm">
                  <Github className="w-4 h-4" />
                  {repo.label || 'Quellcode'}
                </span>
              ))}
              {customLinks.map((link, idx) => (
                <span key={`link-${idx}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground shadow-sm">
                  <ExternalLink className="w-4 h-4" />
                  {link.label || 'Link'}
                </span>
              ))}
              {formData.docsUrl && (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground shadow-sm">
                  <BookOpen className="w-4 h-4" />
                  Dokumentation
                </span>
              )}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border shadow-sm">
                <Scale className="w-4 h-4 shrink-0 text-muted/60" />
                <input
                  className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted/40 w-28"
                  placeholder="Lizenz..."
                  value={formData.license || ''}
                  onChange={(e) => setFormData(p => ({ ...p, license: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Icon picker panel ── */}
        {showIconPicker && (
          <div className="relative z-10 mt-5 p-4 rounded-2xl bg-surface border border-border shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Icon auswählen</span>
              <button onClick={() => setShowIconPicker(false)} className="text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-8 md:grid-cols-12 gap-1.5 mb-3">
              {ICON_OPTIONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  type="button"
                  title={label}
                  onClick={() => { setFormData((p) => ({ ...p, icon: emoji })); setIconUrlInput(''); setShowIconPicker(false); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all border ${
                    formData.icon === emoji ? 'bg-accent/10 border-accent shadow-sm scale-110' : 'bg-surface border-border hover:border-accent/30 hover:bg-surface-secondary'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-field-background rounded-lg px-3 py-1.5 text-sm font-mono border border-border outline-none focus:border-accent transition-colors"
              placeholder="Oder Bild-URL: https://..."
              value={iconUrlInput}
              onChange={(e) => {
                setIconUrlInput(e.target.value);
                if (e.target.value.startsWith('http')) setFormData((p) => ({ ...p, icon: e.target.value }));
              }}
            />
            {iconUploadError && <p className="text-xs text-danger mt-1">{iconUploadError}</p>}
          </div>
        )}

        {/* ── Category picker panel ── */}
        {showCategoryPicker && (
          <div className="relative z-10 mt-5 p-4 rounded-2xl bg-surface border border-border shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Kategorien</span>
              <button onClick={() => setShowCategoryPicker(false)} className="text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PREDEFINED_CATEGORIES.map((cat) => {
                const isSelected = formData.categories?.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      const current = formData.categories || [];
                      setFormData({ ...formData, categories: isSelected ? current.filter((c) => c !== cat) : [...current, cat] });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      isSelected ? 'bg-accent text-white border-accent shadow-sm' : 'bg-surface border-border text-muted hover:border-accent/30 hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 bg-field-background rounded-lg px-3 py-1.5 text-sm border border-border outline-none focus:border-accent transition-colors"
                placeholder="Eigene Kategorie..."
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && categoryInput.trim()) {
                    e.preventDefault();
                    const c = formData.categories || [];
                    if (!c.includes(categoryInput.trim())) setFormData({ ...formData, categories: [...c, categoryInput.trim()] });
                    setCategoryInput('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const c = formData.categories || [];
                  if (categoryInput.trim() && !c.includes(categoryInput.trim())) setFormData({ ...formData, categories: [...c, categoryInput.trim()] });
                  setCategoryInput('');
                }}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="relative z-10 mt-5 rounded-2xl border border-border bg-surface p-5 shadow-lg">
          <div className="mb-5 flex flex-col gap-1">
            <span className="text-sm font-bold text-foreground">Ressourcen & Links</span>
            <p className="text-sm text-muted">Hinterlegen Sie direkte Einstiege, Quellcode und weiterführende Dokumentation sichtbar an einer Stelle.</p>
          </div>
          <div className="space-y-6">
            <LinkListEditor
              title="Live-Zugänge"
              icon={<ExternalLink className="w-4 h-4 text-muted" />}
              items={formData.liveDemos || []}
              onChange={(demos) => setFormData((p) => ({ ...p, liveDemos: demos }))}
              addLabel="Hinzufügen"
              placeholderLabel="Produktivumgebung"
              placeholderUrl="https://..."
            />
            <LinkListEditor
              title="Quellcode"
              icon={<Github className="w-4 h-4 text-muted" />}
              items={formData.repositories || []}
              onChange={(repos) => setFormData((p) => ({ ...p, repositories: repos }))}
              addLabel="Hinzufügen"
              placeholderLabel="Repository"
              placeholderUrl="https://github.com/..."
            />
            <LinkListEditor
              title="Weitere Links"
              icon={<ExternalLink className="w-4 h-4 text-muted" />}
              items={formData.customLinks || []}
              onChange={(links) => setFormData((p) => ({ ...p, customLinks: links }))}
              addLabel="Hinzufügen"
              placeholderLabel="Link"
              placeholderUrl="https://..."
            />
            <div className="grid grid-cols-1 gap-4 border-t border-border pt-2 md:grid-cols-2">
              <TextField onChange={(val) => setFormData((p) => ({ ...p, docsUrl: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Dokumentation URL</Label>
                <Input value={formData.docsUrl || ''} placeholder="https://docs..." className="bg-field-background h-8 font-mono text-sm" />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, authority: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Herausgeber</Label>
                <Input value={formData.authority || ''} placeholder="z.B. Bundesinnenministerium" className="bg-field-background h-8 text-sm" />
              </TextField>
            </div>
          </div>
        </div>
      </header>

      {isNew && editorMode === 'basic' && (
        <div className="mb-8 rounded-2xl border border-dashed border-border/70 bg-surface-secondary/40 p-4 text-sm text-muted">
          Erweiterte Angaben wie Technik, ausführliche Dokumentation, Deployment und Verknüpfungen können Sie jetzt oder nach dem ersten Speichern ergänzen.
        </div>
      )}

      {(!isNew || editorMode === 'advanced') && (
      <>
      {/* ── Tech stack strip (matches detail page position exactly) ── */}
      <div className="flex items-start gap-4 mb-8 bg-surface-secondary/50 p-4 rounded-2xl border border-border">
        <span className="text-xs text-muted uppercase tracking-wider font-bold shrink-0 flex items-center gap-2 pt-1">
          <Layers className="w-4 h-4 text-accent" />
          Technik
        </span>
        <div className="flex gap-2 flex-wrap items-center flex-1">
          {(formData.techStack || []).map((tech: string) => (
            <Chip key={tech} size="sm" variant="soft" className="text-xs font-medium bg-surface border border-border shadow-sm group/tech">
              {tech}
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, techStack: p.techStack?.filter(t => t !== tech) }))}
                className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </Chip>
          ))}
          <div className="flex items-center gap-1 border border-dashed border-border/60 rounded-full px-2 py-1 hover:border-accent/40 transition-colors focus-within:border-accent">
            <input
              className="bg-transparent text-xs outline-none placeholder:text-muted/40 min-w-[110px]"
              placeholder="Technologie hinzufügen..."
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && techInput.trim()) {
                  e.preventDefault();
                  const stack = formData.techStack || [];
                  if (!stack.includes(techInput.trim())) {
                    setFormData(p => ({ ...p, techStack: [...(p.techStack || []), techInput.trim()] }));
                  }
                  setTechInput('');
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (techInput.trim()) {
                  const stack = formData.techStack || [];
                  if (!stack.includes(techInput.trim())) {
                    setFormData(p => ({ ...p, techStack: [...(p.techStack || []), techInput.trim()] }));
                  }
                  setTechInput('');
                }
              }}
              disabled={!techInput.trim()}
              className="text-accent hover:bg-accent/10 rounded-full transition-colors disabled:opacity-30"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Reuse info box ── */}
      {formData.isReuse ? (
        <div className="mb-8 p-6 rounded-2xl border bg-warning/5 border-warning/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-foreground">Nachnutzung</h3>
                <Switch isSelected onChange={(val) => setFormData((p) => ({ ...p, isReuse: val }))}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>
              <p className="text-sm text-muted mb-3">
                Diese App kann als bestehende Installation mitgenutzt werden. Eine technische Installationsanleitung kann optional trotzdem zusätzlich hinterlegt werden.
              </p>
              <div className="mt-3 p-4 rounded-xl bg-surface border border-border">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Voraussetzungen zur Nachnutzung</h4>
                <textarea
                  className="w-full bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted/40 min-h-[60px]"
                  placeholder="Welche Behörden können die App nachnutzen? Was wird benötigt?"
                  value={formData.reuseRequirements || ''}
                  onChange={(e) => setFormData(p => ({ ...p, reuseRequirements: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 flex items-center justify-between p-4 rounded-2xl border border-dashed border-border/60 bg-surface-secondary/30">
          <div className="flex items-center gap-3">
            <Share2 className="w-4 h-4 text-muted/40 shrink-0" />
            <div>
              <span className="text-sm font-medium text-muted">Nachnutzung</span>
              <p className="text-xs text-muted/60">Aktivieren, wenn diese App für andere Behörden zur Mitnutzung bereitgestellt wird.</p>
            </div>
          </div>
          <Switch isSelected={false} onChange={(val) => setFormData((p) => ({ ...p, isReuse: val }))}>
            <Switch.Control><Switch.Thumb /></Switch.Control>
          </Switch>
        </div>
      )}

      {/* ── Tabbed content (matches detail page tabs exactly) ── */}
      <Tabs variant="secondary" className="w-full">
        <Tabs.ListContainer className="border-b border-border mb-6">
          <Tabs.List aria-label="App-Details Bereiche" className="gap-8">
            <Tabs.Tab id="docs" className="gap-2 py-3 text-sm font-semibold">
              <BookOpen className="w-4 h-4" />
              Dokumentation
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="details" className="gap-2 py-3 text-sm font-semibold whitespace-nowrap">
              <Layers className="w-4 h-4" />
              Fachliche Details
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="deployment" className="gap-2 py-3 text-sm font-semibold">
              <Server className="w-4 h-4" />
              Deployment
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="ratings" className="gap-2 py-3 text-sm font-semibold">
              <Star className="w-4 h-4" />
              Bewertungen
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-secondary border border-border text-muted/70 ml-1">Nur Ansicht</span>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="related" className="gap-2 py-3 text-sm font-semibold whitespace-nowrap">
              <Link2 className="w-4 h-4" />
              Verwandte Apps
              {!isNew && relatedApps.length > 0 && (
                <span className="text-[10px] bg-surface border border-border rounded-full px-2 py-0.5 font-bold shadow-sm">{relatedApps.length}</span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Dokumentation tab */}
        <Tabs.Panel id="docs">
          <div className="space-y-4">
            <p className="text-xs text-muted">Verfassen Sie eine ausführliche Dokumentation im Markdown-Format.</p>
            <TextField onChange={(val) => setFormData((p) => ({ ...p, markdownContent: val }))}>
              <TextArea
                value={formData.markdownContent || ''}
                placeholder={`# ${formData.name || 'App Name'}\n\nBeschreiben Sie Ihre App hier im Detail...\n\n## Features\n\n- Feature 1\n- Feature 2`}
                className="bg-field-background font-mono text-sm min-h-[500px]"
              />
            </TextField>
          </div>
        </Tabs.Panel>

        {/* Fachliche Details tab */}
        <Tabs.Panel id="details">
          <div className="space-y-6">
            <p className="text-xs text-muted">
              Felder ohne Inhalt werden in der App-Detailansicht nicht angezeigt.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Authority card */}
              <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/30 transition-colors">
                <dt className="text-xs text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
                  <span className="text-accent">{resolveIcon('Building2')}</span>
                  Herausgeber
                </dt>
                <dd>
                  <input
                    className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-transparent hover:border-accent/30 focus:border-accent transition-colors"
                    value={formData.authority || ''}
                    onChange={(e) => setFormData(p => ({ ...p, authority: e.target.value }))}
                    placeholder="z.B. Bundesinnenministerium"
                  />
                </dd>
              </div>
              {/* Dynamic platform detail fields */}
              {metaFields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/30 transition-colors">
                  <dt className="text-xs text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
                    {field.icon && <span className="text-accent">{field.icon}</span>}
                    {field.label}
                  </dt>
                  <dd>
                    <input
                      className="w-full bg-transparent text-sm font-medium text-foreground outline-none border-b border-transparent hover:border-accent/30 focus:border-accent transition-colors"
                      value={field.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        const fields: AppField[] = [...(formData.customFields ?? [])];
                        const idx = fields.findIndex(f => f.key === field.key);
                        if (val) {
                          if (idx >= 0) fields[idx] = { key: field.key, value: val };
                          else fields.push({ key: field.key, value: val });
                        } else if (idx >= 0) {
                          fields.splice(idx, 1);
                        }
                        setFormData(p => ({ ...p, customFields: fields }));
                      }}
                      placeholder={field.label}
                    />
                  </dd>
                </div>
              ))}
            </dl>

            {/* Admin: featured toggle */}
            {isAdmin && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-accent/5 border border-accent/10">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground">Ausgezeichnet (Empfehlung)</span>
                  <p className="text-xs text-muted">Hervorgehobene Apps erscheinen mit einer speziellen Markierung im Store.</p>
                </div>
                <Switch
                  isSelected={formData.isFeatured || false}
                  onChange={(val) => setFormData((p) => ({ ...p, isFeatured: val }))}
                >
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* Deployment tab */}
        <Tabs.Panel id="deployment">
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Hier können technische Installationsanleitungen hinterlegt werden. Dieser Bereich kann unabhängig von Nachnutzung aktiviert werden.
            </p>
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
              <div>
                <span className="text-sm font-bold text-foreground">Deployment Assistant aktivieren</span>
                <p className="text-xs text-muted">Zeigt Docker/Compose/Helm-Kommandos in der App-Detailseite an.</p>
              </div>
              <Switch
                isSelected={formData.hasDeploymentAssistant ?? true}
                onChange={(val) => setFormData((p) => ({ ...p, hasDeploymentAssistant: val }))}
              >
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch>
            </div>

            {formData.hasDeploymentAssistant !== false && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'showHelm', label: 'Helm Chart', icon: <Server className="w-4 h-4" /> },
                    { key: 'showCompose', label: 'Docker Compose', icon: <Terminal className="w-4 h-4" /> },
                    { key: 'showDocker', label: 'Docker', icon: <Terminal className="w-4 h-4" /> },
                  ].map(({ key, label, icon }) => {
                    const active = formData[key as keyof AppConfig] !== false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, [key]: !p[key as keyof AppConfig] }))}
                        className={`p-3 rounded-xl border-2 text-center flex flex-col items-center gap-2 transition-all ${
                          active ? 'border-accent bg-accent/5 text-accent' : 'border-border bg-surface text-muted'
                        }`}
                      >
                        {icon}
                        <span className="text-xs font-semibold">{label}</span>
                        <span className="text-[10px]">{active ? 'Aktiv' : 'Ausgeblendet'}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Helm config */}
                {formData.showHelm !== false && (
                  <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <Server className="w-4 h-4 text-muted" />
                      <span className="text-sm font-bold">Helm Chart</span>
                    </div>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, helmRepo: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Helm Chart Repo</Label>
                      <Input value={formData.helmRepo || ''} placeholder="oci://..." className="bg-field-background font-mono text-sm" />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmCommand: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Benutzerdefiniertes Helm-Kommando</Label>
                      <TextArea value={formData.customHelmCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`helm repo add bund https://...\nhelm install ${formData.id || 'appname'} bund/${formData.id || 'appname'}`} />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmValues: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Values.yaml Inhalt</Label>
                      <TextArea value={formData.customHelmValues || ''} className="bg-field-background font-mono text-sm" placeholder="image:\n  tag: latest\nreplicas: 1" />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customHelmNote: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                      <Input value={formData.customHelmNote || ''} placeholder="Zusätzliche Hinweise..." className="bg-field-background" />
                    </TextField>
                  </div>
                )}

                {/* Compose config */}
                {formData.showCompose !== false && (
                  <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <Terminal className="w-4 h-4 text-muted" />
                      <span className="text-sm font-bold">Docker Compose</span>
                    </div>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customComposeCommand: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Compose-Setup</Label>
                      <TextArea value={formData.customComposeCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`version: '3.8'\nservices:\n  ${formData.id || 'app'}:\n    image: ...`} />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customComposeNote: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                      <Input value={formData.customComposeNote || ''} className="bg-field-background" />
                    </TextField>
                  </div>
                )}

                {/* Docker config */}
                {formData.showDocker !== false && (
                  <div className="space-y-3 bg-surface/50 p-5 rounded-2xl border border-border">
                    <div className="flex items-center gap-2 border-b border-border pb-2">
                      <Terminal className="w-4 h-4 text-muted" />
                      <span className="text-sm font-bold">Docker</span>
                    </div>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, dockerRepo: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Docker Image</Label>
                      <Input value={formData.dockerRepo || ''} placeholder="image:latest" className="bg-field-background font-mono text-sm" />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customDockerCommand: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Docker-Kommando</Label>
                      <TextArea value={formData.customDockerCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`docker pull ...\ndocker run -d --name ${formData.id || 'app'} -p 8080:80 ...`} />
                    </TextField>
                    <TextField onChange={(val) => setFormData((p) => ({ ...p, customDockerNote: val }))}>
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-wider">Hinweis</Label>
                      <Input value={formData.customDockerNote || ''} className="bg-field-background" />
                    </TextField>
                  </div>
                )}
              </>
            )}
          </div>
        </Tabs.Panel>

        {/* Bewertungen tab */}
        <Tabs.Panel id="ratings">
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center">
              <Star className="w-8 h-8 text-muted/30" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Bewertungen</h3>
            <p className="text-sm text-muted text-center max-w-md">
              Bewertungen werden von Nutzern abgegeben und können hier nicht bearbeitet werden.
              Nach dem Veröffentlichen können Nutzer Ihre App bewerten.
            </p>
            {!isNew && initialApp?.ratingCount !== undefined && initialApp.ratingCount > 0 && (
              <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-surface border border-border">
                <Star className="w-5 h-5 fill-gov-gold text-gov-gold" />
                <span className="font-bold text-foreground">{(initialApp.ratingAvg || 0).toFixed(1)}</span>
                <span className="text-muted">({initialApp.ratingCount} Bewertungen)</span>
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* Verwandte Apps + Gruppen tab */}
        <Tabs.Panel id="related">
          {isNew ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center">
                <Link2 className="w-6 h-6 text-muted" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">App zuerst speichern</p>
                <p className="text-xs text-muted mt-1">Verknüpfte Apps und Gruppen können nach dem ersten Speichern eingerichtet werden.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {/* Groups display (if any) */}
              {isAdmin && appGroupIds.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groups.filter(g => appGroupIds.has(g.id)).map(g => (
                    <Chip key={g.id} size="sm" variant="soft" color="accent" className="text-xs font-semibold">
                      {g.name}
                    </Chip>
                  ))}
                </div>
              )}

              {/* Current related apps grid */}
              {relatedApps.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedApps.map(related => (
                    <div
                      key={related.id}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/40 hover:bg-surface transition-all shadow-sm group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface border border-border shadow-sm flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        {related.icon?.startsWith('http') ? (
                          <Image src={related.icon} alt={related.name} width={40} height={40} className="object-contain p-1" unoptimized />
                        ) : (
                          related.icon || '🏛️'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-accent transition-colors">{related.name}</p>
                        <p className="text-xs text-muted flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> {related.id}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRelated(related.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-danger/10 text-danger"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search and add related apps */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">App suchen und verknüpfen</span>
                <input
                  className="w-full bg-field-background rounded-xl px-4 py-2.5 text-sm border border-border outline-none focus:border-accent transition-colors"
                  placeholder="App-Name oder ID suchen..."
                  value={relatedSearch}
                  onChange={(e) => setRelatedSearch(e.target.value)}
                />
                {relatedSearch && (
                  <div className="border border-border rounded-xl bg-surface overflow-hidden max-h-64 overflow-y-auto">
                    {filteredRelatable.slice(0, 10).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleAddRelated(a)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-surface-secondary transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <span className="text-xl shrink-0">{a.icon?.startsWith('http') ? '🏛️' : a.icon || '🏛️'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{a.name}</p>
                          <p className="text-xs text-muted">{a.categories?.join(', ')}</p>
                        </div>
                        {addingRelated ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" />
                        ) : (
                          <Plus className="w-4 h-4 text-accent shrink-0" />
                        )}
                      </button>
                    ))}
                    {filteredRelatable.length === 0 && (
                      <p className="p-4 text-sm text-muted text-center">Keine weiteren Apps gefunden</p>
                    )}
                  </div>
                )}
              </div>

              {/* Groups management (admin only) */}
              {isAdmin && (
                <div className="space-y-4 pt-6 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Grip className="w-4 h-4 text-accent" />
                    <span className="text-sm font-bold text-foreground">Gruppen</span>
                  </div>
                  <p className="text-xs text-muted">Ordnen Sie diese App einer oder mehreren Gruppen zu.</p>

                  <div className="space-y-2">
                    {groups.map((group) => {
                      const inGroup = appGroupIds.has(group.id);
                      return (
                        <div
                          key={group.id}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            inGroup ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-foreground">{group.name}</p>
                            {group.description && <p className="text-xs text-muted">{group.description}</p>}
                          </div>
                          <Switch isSelected={inGroup} onChange={() => handleToggleGroup(group.id)}>
                            <Switch.Control><Switch.Thumb /></Switch.Control>
                          </Switch>
                        </div>
                      );
                    })}
                    {groups.length === 0 && (
                      <p className="text-sm text-muted text-center py-4 bg-surface rounded-xl border border-dashed border-border/60">
                        Noch keine Gruppen erstellt.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-field-background rounded-xl px-4 py-2 text-sm border border-border outline-none focus:border-accent transition-colors"
                      placeholder="Neue Gruppe erstellen..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                    />
                    <button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim() || creatingGroup}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Erstellen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </Tabs.Panel>
      </Tabs>
          </>
          )}

      {/* ── Footer meta (matches detail page) ── */}
      <div className="mt-12 pt-4 border-t border-separator flex items-center justify-between text-[11px] text-muted">
        <span>ID: <code className="font-mono">{formData.id || '—'}</code></span>
        <span>
          Aktualisiert: {initialApp?.updatedAt ? new Date(initialApp.updatedAt).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          }) : '—'}
        </span>
      </div>

      {/* ── Sticky save bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {hasUnsavedChanges && !saveError && !saveSuccess && (
              <p className="text-xs text-muted truncate mb-1">
                Ungespeicherte Änderungen. Erfasste Angaben: <span className="font-semibold">{requiredDoneCount}/{requiredItems.length}</span>
              </p>
            )}
            {!canSave && !saveError && !saveSuccess && (
              <p className="text-xs text-muted truncate">
                Für einen Entwurf sind <span className="font-semibold">Name</span> und <span className="font-semibold">ID</span> nötig. Für Status außer Entwurf zusätzlich <span className="font-semibold">Kategorie</span> und <span className="font-semibold">Kurzbeschreibung</span>.
              </p>
            )}
            {saveError && <p className="text-sm text-danger font-medium truncate">{saveError}</p>}
            {saveSuccess && (
              <span className="text-sm text-success flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Gespeichert!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted md:inline-flex">
              Arbeitsstand: {getAppStatusLabel(formData.status || (isNew ? DRAFT_STATUS : '')) || 'Offen'}
            </span>
            {isNew && (
              <button
                type="button"
                onClick={() => setEditorMode((mode) => mode === 'basic' ? 'advanced' : 'basic')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-secondary border border-border transition-colors"
              >
                {editorMode === 'basic' ? 'Erweitert öffnen' : 'Basisansicht'}
              </button>
            )}
            <button
              onClick={() => requestNavigation(backUrl)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface-secondary border border-border transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Speichert...' : isDraft ? 'Entwurf speichern' : (isNew ? 'App speichern' : 'Änderungen speichern')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Seite verlassen"
        description="Es gibt ungespeicherte Änderungen. Wenn Sie die Seite jetzt verlassen, gehen diese Anpassungen verloren."
        isOpen={!!pendingNavigation}
        onConfirm={confirmNavigation}
        onOpenChange={(open) => {
          if (!open) setPendingNavigation(null);
        }}
        title="Ungespeicherte Änderungen verwerfen?"
      />
    </div>
  );
}
