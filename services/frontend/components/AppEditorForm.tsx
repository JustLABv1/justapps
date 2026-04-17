'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DeploymentTab } from '@/components/editor/DeploymentTab';
import { GitLabFormState, GitLabTab } from '@/components/editor/GitLabTab';
import { LinkListEditor } from '@/components/editor/LinkListEditor';
import { RelatedAppsTab } from '@/components/editor/RelatedAppsTab';
import { AppConfig, AppField, GitLabIntegrationState, GitLabProviderSummary } from '@/config/apps';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { fetchApi, uploadFile } from '@/lib/api';
import { DRAFT_STATUS, getAppStatusLabel, isDraftStatus } from '@/lib/appStatus';
import { getImageAssetUrl, isImageAssetSource } from '@/lib/assets';
import { resolveIcon } from '@/lib/detailFieldIcons';
import {
    Button,
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
    ChevronRight,
    CloudDownload,
    ExternalLink,
    GitBranch,
    Github,
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
    Tag,
    Terminal,
    Upload,
    X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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


const defaultGitLabFormState: GitLabFormState = {
  providerKey: '',
  projectPath: '',
  branch: '',
  readmePath: '',
  helmValuesPath: '',
  composeFilePath: '',
};

function normalizeGitLabFormState(integration: GitLabIntegrationState | null): GitLabFormState {
  const fallbackProviderKey = integration?.availableProviders?.[0]?.key || '';

  return {
    providerKey: integration?.providerKey || fallbackProviderKey,
    projectPath: integration?.projectPath || '',
    branch: integration?.branch || '',
    readmePath: integration?.readmePath || '',
    helmValuesPath: integration?.helmValuesPath || '',
    composeFilePath: integration?.composeFilePath || '',
  };
}

function getGitLabStatusMeta(status?: string) {
  switch (status) {
    case 'success':
      return { label: 'Synchronisiert', className: 'border-success/30 bg-success/10 text-success' };
    case 'warning':
      return { label: 'Mit Hinweisen', className: 'border-warning/30 bg-warning/10 text-warning' };
    case 'pending_approval':
      return { label: 'Wartet auf Freigabe', className: 'border-warning/30 bg-warning/10 text-warning' };
    case 'error':
      return { label: 'Fehlgeschlagen', className: 'border-danger/30 bg-danger/10 text-danger' };
    default:
      return { label: 'Noch nicht synchronisiert', className: 'border-border bg-surface text-muted' };
  }
}


// ── AppEditorForm ─────────────────────────────────────────────────────────────

interface AppEditorFormProps {
  initialApp: AppConfig | null;
  existingApps: AppConfig[];
  initialFormData?: Partial<AppConfig> | null;
  copySource?: { id: string; name: string } | null;
}

export function AppEditorForm({ initialApp, existingApps, initialFormData = null, copySource = null }: AppEditorFormProps) {
  const router = useRouter();
  const { user, profileReady, refreshUser } = useAuth();
  const { settings } = useSettings();

  const isNew = !initialApp;
  const initialEditorValues = initialFormData ?? initialApp;
  const isCopyFlow = isNew && !!copySource;
  const isAdmin = user?.role === 'admin';
  const backUrl = isAdmin ? '/verwaltung/apps' : '/meine-apps';

  // ── Form data ──
  const [formData, setFormData] = useState<Partial<AppConfig>>(() =>
    initialEditorValues ?? {
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
    isImageAssetSource(initialEditorValues?.icon) ? initialEditorValues?.icon || '' : ''
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
  const [currentCreateStep, setCurrentCreateStep] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // ── Related apps ──
  const [relatedApps, setRelatedApps] = useState<{ id: string; name: string; icon?: string }[]>(
    initialApp?.relatedApps || []
  );
  const [relatedSearch, setRelatedSearch] = useState('');
  const [addingRelated, setAddingRelated] = useState(false);

  // ── Groups ──
  const [groups, setGroups] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [appGroupIds, setAppGroupIds] = useState<Set<string>>(
    new Set((initialApp?.appGroups || []).map((g) => g.id))
  );
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [gitLabIntegration, setGitLabIntegration] = useState<GitLabIntegrationState | null>(null);
  const [gitLabForm, setGitLabForm] = useState<GitLabFormState>(defaultGitLabFormState);
  const [loadingGitLab, setLoadingGitLab] = useState(!isNew);
  const [savingGitLab, setSavingGitLab] = useState(false);
  const [syncingGitLab, setSyncingGitLab] = useState(false);
  const [gitLabError, setGitLabError] = useState<string | null>(null);
  const [creationProviders, setCreationProviders] = useState<GitLabProviderSummary[]>([]);
  const [preCreatedAppId, setPreCreatedAppId] = useState<string | null>(null);
  const initialSnapshotRef = useRef('');
  const skipUnsavedWarningRef = useRef(false);

  // ── Auto-save state ──
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const autoSaveAppIdRef = useRef<string | null>(initialApp?.id || null);
  const formIconSrc = getImageAssetUrl(formData.icon);

  // ── Auto-save effect (drafts only) ──
  useEffect(() => {
    const isDraftNow = isDraftStatus(formData.status);
    if (!isDraftNow) return;

    const interval = setInterval(async () => {
      if (saving) return;
      const body: Partial<AppConfig> = {
        ...formData,
        categories: Array.isArray(formData.categories) ? formData.categories : [],
        techStack: Array.isArray(formData.techStack) ? formData.techStack : [],
        repositories: (formData.repositories || []).filter((l) => l.url?.trim()).map((l) => ({ label: l.label || 'Link', url: l.url })),
        customLinks: (formData.customLinks || []).filter((l) => l.url?.trim()).map((l) => ({ label: l.label || 'Link', url: l.url })),
        liveDemos: (formData.liveDemos || []).filter((d) => d.url?.trim()),
        status: DRAFT_STATUS,
      };

      try {
        if (!autoSaveAppIdRef.current) {
          if (!formData.name?.trim() || !formData.id?.trim()) return;
          const res = await fetchApi('/apps', { method: 'POST', body: JSON.stringify(body) });
          if (res.ok) {
            const created: AppConfig = await res.json();
            autoSaveAppIdRef.current = created.id;
            setFormData((p) => ({ ...p, id: created.id }));
            setLastAutoSave(new Date());
          }
        } else {
          const res = await fetchApi(`/apps/${autoSaveAppIdRef.current}`, { method: 'PUT', body: JSON.stringify(body) });
          if (res.ok) setLastAutoSave(new Date());
        }
      } catch { /* silent — auto-save must never block the user */ }
    }, 30_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftStatus(formData.status), saving]);

  const isIdTaken =
    isNew && !!formData.id?.trim() && existingApps.some((a) => a.id === formData.id?.trim());

  // Load groups
  useEffect(() => {
    if (isAdmin) {
      fetchApi('/app-groups')
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setGroups(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isAdmin]);

    useEffect(() => {
      if (!isNew || currentCreateStep !== 2) return;
      fetchApi('/settings/gitlab/providers/available')
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setCreationProviders(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, [isNew, currentCreateStep]);

    useEffect(() => {
      if (isNew || !initialApp) {
        setLoadingGitLab(false);
        return;
      }

      let active = true;
      setLoadingGitLab(true);

      fetchApi(`/apps/${initialApp.id}/gitlab`, { cache: 'no-store' })
        .then(async (response) => {
          if (!active) return;
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error((error as { message?: string }).message || 'GitLab-Daten konnten nicht geladen werden.');
          }

          const data = await response.json() as GitLabIntegrationState;
          setGitLabIntegration(data);
          setGitLabForm(normalizeGitLabFormState(data));
          setGitLabError(null);
        })
        .catch((error) => {
          if (!active) return;
          setGitLabError(error instanceof Error ? error.message : 'GitLab-Daten konnten nicht geladen werden.');
        })
        .finally(() => {
          if (active) setLoadingGitLab(false);
        });

      return () => {
        active = false;
      };
    }, [initialApp, isNew]);

    useEffect(() => {
      const selectedProvider = gitLabIntegration?.availableProviders?.find((provider) => provider.key === gitLabForm.providerKey);
      if (!selectedProvider) return;

      setGitLabForm((prev) => ({
        ...prev,
        readmePath: prev.readmePath || selectedProvider.defaultReadmePath || '',
        helmValuesPath: prev.helmValuesPath || selectedProvider.defaultHelmValuesPath || '',
        composeFilePath: prev.composeFilePath || selectedProvider.defaultComposeFilePath || '',
      }));
    }, [gitLabForm.providerKey, gitLabIntegration?.availableProviders]);

  // ── Creation-wizard GitLab sync ──
  const handleCreationGitLabSync = async () => {
    if (!gitLabForm.projectPath?.trim() || !gitLabForm.providerKey?.trim()) return;
    setSyncingGitLab(true);
    setGitLabError(null);
    try {
      const appId = await ensureEditableAppId();
      // Link GitLab
      const linkRes = await fetchApi(`/apps/${appId}/gitlab`, {
        method: 'PUT',
        body: JSON.stringify(gitLabForm),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || 'GitLab-Verknüpfung konnte nicht gespeichert werden.');
      }
      // Sync
      const syncRes = await fetchApi(`/apps/${appId}/gitlab/sync`, { method: 'POST' });
      if (!syncRes.ok) {
        const err = await syncRes.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || 'GitLab-Synchronisation fehlgeschlagen.');
      }
      const integration = await syncRes.json() as GitLabIntegrationState;
      setGitLabIntegration(integration);
      setGitLabForm(normalizeGitLabFormState(integration));

      // Auto-apply all available snapshot data immediately
      const snapshot = integration.snapshot;
      if (snapshot) {
        setFormData((prev) => {
          const next = { ...prev };

          if (snapshot.readmeContent?.trim()) {
            next.markdownContent = snapshot.readmeContent.trim();
          }

          if (snapshot.description?.trim()) next.description = snapshot.description.trim();
          if (snapshot.license?.trim()) next.license = snapshot.license.trim();

          const topicSet = new Set([...(prev.tags || [])]);
          for (const topic of snapshot.topics || []) {
            if (topic?.trim()) topicSet.add(topic.trim());
          }
          next.tags = Array.from(topicSet);

          const repos = [...(prev.repositories || [])];
          if (snapshot.projectWebUrl && !repos.some((r) => r.url === snapshot.projectWebUrl)) {
            repos.push({ label: 'GitLab', url: snapshot.projectWebUrl });
          }
          next.repositories = repos;

          if (snapshot.helmValuesContent?.trim()) {
            next.showHelm = true;
            next.customHelmValues = snapshot.helmValuesContent.trim();
          }
          if (snapshot.composeFileContent?.trim()) {
            next.showCompose = true;
            next.customComposeCommand = snapshot.composeFileContent.trim();
          }

          return next;
        });
      }

      toast.success('GitLab synchronisiert – Daten wurden übernommen.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitLab-Synchronisation fehlgeschlagen.';
      setGitLabError(message);
      toast.danger(message);
    } finally {
      setSyncingGitLab(false);
    }
  };

  // ── Helpers ──
  const sanitizeLinks = (links: { label?: string; url?: string }[] | undefined) =>
    (links || []).filter((l) => l.url?.trim()).map((l) => ({ label: l.label || 'Link', url: l.url! }));

  const getEffectiveAppId = () => initialApp?.id || preCreatedAppId || autoSaveAppIdRef.current || null;

  const ensureEditableAppId = async () => {
    const existingAppId = getEffectiveAppId();

    if (existingAppId) {
      return existingAppId;
    }

    if (!formData.name?.trim() || !formData.id?.trim()) {
      throw new Error('Bitte zuerst Name und ID ausfüllen, damit ein Entwurf für Verknüpfungen angelegt werden kann.');
    }

    const body: Partial<AppConfig> = {
      ...formData,
      categories: Array.isArray(formData.categories) ? formData.categories : [],
      techStack: Array.isArray(formData.techStack) ? formData.techStack : [],
      repositories: sanitizeLinks(formData.repositories) as AppConfig['repositories'],
      customLinks: sanitizeLinks(formData.customLinks) as AppConfig['customLinks'],
      liveDemos: (formData.liveDemos || []).filter((demo) => demo.url?.trim()),
      status: formData.status?.trim() || DRAFT_STATUS,
    };

    const response = await fetchApi('/apps', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as { message?: string }).message || 'Entwurf konnte nicht automatisch angelegt werden.');
    }

    const createdApp = await response.json() as AppConfig;
    autoSaveAppIdRef.current = createdApp.id;
    setPreCreatedAppId(createdApp.id);
    setFormData((previous) => ({ ...previous, id: createdApp.id }));
    setLastAutoSave(new Date());

    return createdApp.id;
  };

  const repositories = formData.repositories && formData.repositories.length > 0
    ? formData.repositories
    : [];
  const customLinks = formData.customLinks || [];
  const liveDemos = formData.liveDemos && formData.liveDemos.length > 0
    ? formData.liveDemos
    : [];

  // ── Save ──
  const handleSave = async () => {
    if (!profileReady) {
      const refreshed = await refreshUser();
      if (!refreshed) {
        const message = 'Ihr Benutzerprofil wird noch synchronisiert. Bitte erneut versuchen.';
        setSaveError(message);
        toast.danger(message);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const effectiveAppId = getEffectiveAppId();
      const method = effectiveAppId ? 'PUT' : 'POST';
      const url = effectiveAppId ? `/apps/${effectiveAppId}` : '/apps';
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
        const savedApp = method === 'POST'
          ? await res.json().catch(() => null) as AppConfig | null
          : null;
        const savedAppId = effectiveAppId || savedApp?.id || null;

        if (savedAppId) {
          autoSaveAppIdRef.current = savedAppId;
          setPreCreatedAppId(savedAppId);
        }

        if (isNew && savedAppId && gitLabForm.providerKey?.trim() && gitLabForm.projectPath?.trim()) {
          await fetchApi(`/apps/${savedAppId}/gitlab`, {
              method: 'PUT',
              body: JSON.stringify(gitLabForm),
          }).catch(() => null);
        }
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
    setAddingRelated(true);
    try {
      const appId = await ensureEditableAppId();
      const res = await fetchApi(`/apps/${appId}/related`, {
        method: 'POST',
        body: JSON.stringify({ relatedAppId: app.id }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error((error as { message?: string }).message || 'Verwandte App konnte nicht verknüpft werden.');
      }

      setRelatedApps((prev) => [...prev, { id: app.id, name: app.name, icon: app.icon }]);
      setRelatedSearch('');
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Verwandte App konnte nicht verknüpft werden.');
    } finally {
      setAddingRelated(false);
    }
  };

  const handleRemoveRelated = async (relatedId: string) => {
    const appId = getEffectiveAppId();
    if (!appId) return;

    const response = await fetchApi(`/apps/${appId}/related/${relatedId}`, { method: 'DELETE' });
    if (response.ok) {
      setRelatedApps((prev) => prev.filter((a) => a.id !== relatedId));
    }
  };

  const handleToggleGroup = async (groupId: string) => {
    try {
      const appId = await ensureEditableAppId();
      const inGroup = appGroupIds.has(groupId);
      if (inGroup) {
        await fetchApi(`/app-groups/${groupId}/members/${appId}`, { method: 'DELETE' });
        setAppGroupIds((prev) => { const s = new Set(prev); s.delete(groupId); return s; });
      } else {
        await fetchApi(`/app-groups/${groupId}/members`, {
          method: 'POST',
          body: JSON.stringify({ appId }),
        });
        setAppGroupIds((prev) => new Set([...prev, groupId]));
      }
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Gruppe konnte nicht aktualisiert werden.');
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

  const reloadCurrentApp = async () => {
    if (!initialApp) return;
    const response = await fetchApi(`/apps/${initialApp.id}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json() as AppConfig;
    setFormData(data);
    initialSnapshotRef.current = buildSnapshot(data);
  };

  const handleSaveGitLabLink = async () => {
    if (!initialApp) return;
    setSavingGitLab(true);
    setGitLabError(null);
    try {
      const response = await fetchApi(`/apps/${initialApp.id}/gitlab`, {
        method: 'PUT',
        body: JSON.stringify(gitLabForm),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || 'GitLab-Verknüpfung konnte nicht gespeichert werden.');
      }

      const integration = data as GitLabIntegrationState;
      setGitLabIntegration(integration);
      setGitLabForm(normalizeGitLabFormState(integration));
      toast.success('GitLab-Verknüpfung gespeichert.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitLab-Verknüpfung konnte nicht gespeichert werden.';
      setGitLabError(message);
      toast.danger(message);
    } finally {
      setSavingGitLab(false);
    }
  };

  const handleSyncGitLab = async () => {
    if (!initialApp) return;
    setSyncingGitLab(true);
    setGitLabError(null);
    try {
      const response = await fetchApi(`/apps/${initialApp.id}/gitlab/sync`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || 'GitLab-Synchronisation fehlgeschlagen.');
      }

      const integration = data as GitLabIntegrationState;
      setGitLabIntegration(integration);
      setGitLabForm(normalizeGitLabFormState(integration));
      if (integration.approvalRequired) {
        toast.success('GitLab-Sync erzeugt eine freizugebende Änderung.');
      } else {
        await reloadCurrentApp();
        toast.success(integration.lastSyncStatus === 'warning' ? 'GitLab synchronisiert, aber mit Hinweisen.' : 'GitLab erfolgreich synchronisiert.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitLab-Synchronisation fehlgeschlagen.';
      setGitLabError(message);
      toast.danger(message);
    } finally {
      setSyncingGitLab(false);
    }
  };

  const handleDeleteGitLabLink = async () => {
    if (!initialApp) return;
    setSavingGitLab(true);
    setGitLabError(null);
    try {
      const response = await fetchApi(`/apps/${initialApp.id}/gitlab`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || 'GitLab-Verknüpfung konnte nicht entfernt werden.');
      }

      const integration = data as GitLabIntegrationState;
      setGitLabIntegration(integration);
      setGitLabForm(normalizeGitLabFormState(integration));
      toast.success('GitLab-Verknüpfung entfernt.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitLab-Verknüpfung konnte nicht entfernt werden.';
      setGitLabError(message);
      toast.danger(message);
    } finally {
      setSavingGitLab(false);
    }
  };

  const handleApproveGitLab = async () => {
    if (!initialApp) return;
    setSavingGitLab(true);
    setGitLabError(null);
    try {
      const response = await fetchApi(`/apps/${initialApp.id}/gitlab/approve`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { message?: string }).message || 'GitLab-Änderung konnte nicht freigegeben werden.');
      }

      const integration = data as GitLabIntegrationState;
      setGitLabIntegration(integration);
      setGitLabForm(normalizeGitLabFormState(integration));
      await reloadCurrentApp();
      toast.success('GitLab-Änderung wurde freigegeben und übernommen.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'GitLab-Änderung konnte nicht freigegeben werden.';
      setGitLabError(message);
      toast.danger(message);
    } finally {
      setSavingGitLab(false);
    }
  };

  const handleApplyGitLabReadme = () => {
    const readmeContent = gitLabIntegration?.snapshot?.readmeContent?.trim();
    if (!readmeContent) return;

    setFormData((prev) => ({ ...prev, markdownContent: readmeContent }));
    toast.success('README in den Editor übernommen.');
  };

  const handleApplyGitLabMetadata = () => {
    const snapshot = gitLabIntegration?.snapshot;
    if (!snapshot) return;

    setFormData((prev) => {
      const nextRepositories = [...(prev.repositories || [])];
      if (snapshot.projectWebUrl && !nextRepositories.some((link) => link.url === snapshot.projectWebUrl)) {
        nextRepositories.push({ label: 'GitLab', url: snapshot.projectWebUrl });
      }

      const topicSet = new Set([...(prev.tags || [])]);
      for (const topic of snapshot.topics || []) {
        if (topic?.trim()) topicSet.add(topic.trim());
      }

      return {
        ...prev,
        description: snapshot.description?.trim() || prev.description,
        license: snapshot.license?.trim() || prev.license,
        repositories: nextRepositories,
        tags: Array.from(topicSet),
      };
    });

    toast.success('GitLab-Metadaten in den Editor übernommen.');
  };

  const handleApplyGitLabDeployment = () => {
    const snapshot = gitLabIntegration?.snapshot;
    if (!snapshot) return;

    setFormData((prev) => ({
      ...prev,
      showHelm: snapshot.helmValuesContent?.trim() ? true : prev.showHelm,
      showCompose: snapshot.composeFileContent?.trim() ? true : prev.showCompose,
      customHelmValues: snapshot.helmValuesContent?.trim() || prev.customHelmValues,
      customComposeCommand: snapshot.composeFileContent?.trim() || prev.customComposeCommand,
    }));

    toast.success('GitLab-Deploymentdaten in den Editor übernommen.');
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

  const createSteps = [
    {
      id: 'identity',
      phase: 'Basisdaten',
      label: 'Identität',
      hint: 'Icon, Name, ID und Kategorien',
      icon: <Pencil className="w-4 h-4" />,
    },
    {
      id: 'profile',
      phase: 'Basisdaten',
      label: 'Kurzprofil',
      hint: 'Status, Beschreibung und Schlagwörter',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: 'gitlab',
      phase: 'Erweiterte Angaben',
      label: 'GitLab-Import',
      hint: 'Repository verknüpfen und Daten importieren',
      icon: <GitBranch className="w-4 h-4" />,
    },
    {
      id: 'deployment',
      phase: 'Erweiterte Angaben',
      label: 'Bereitstellung',
      hint: 'Nachnutzung und Installationswege',
      icon: <Server className="w-4 h-4" />,
    },
    {
      id: 'resources',
      phase: 'Erweiterte Angaben',
      label: 'Ressourcen',
      hint: 'Links, Repositories und Doku-URL',
      icon: <ExternalLink className="w-4 h-4" />,
    },
    {
      id: 'details',
      phase: 'Erweiterte Angaben',
      label: 'Fachliche Angaben',
      hint: 'Herausgeber, Details und Hinweise',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'documentation',
      phase: 'Erweiterte Angaben',
      label: 'Dokumentation',
      hint: 'Markdown für die Detailansicht',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ] as const;
  const lastCreateStepIndex = createSteps.length - 1;
  const currentCreateStepDef = createSteps[currentCreateStep];
  const currentCreatePhase = currentCreateStepDef.phase;
  const gitLabStatus = getGitLabStatusMeta(gitLabIntegration?.lastSyncStatus);
  const hasGitLabProviders = (gitLabIntegration?.availableProviders?.length || 0) > 0;
  const gitLabSnapshot = gitLabIntegration?.approvalRequired && gitLabIntegration?.pendingSnapshot
    ? gitLabIntegration.pendingSnapshot
    : gitLabIntegration?.snapshot;
  const isCreateStepValid = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return !!formData.name?.trim() && !!formData.id?.trim() && (formData.categories?.length ?? 0) > 0 && !isIdTaken;
      case 1:
        return !requiresExpandedDetails || !!formData.description?.trim();
      case 2: // gitlab — always optional
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      default:
        return true;
    }
  };
  const isCreateStepCompleted = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return isCreateStepValid(0);
      case 1:
        return !!formData.description?.trim()
          || (formData.status?.trim() && formData.status !== DRAFT_STATUS)
          || (formData.tags?.length ?? 0) > 0
          || (!!formData.license?.trim() && formData.license !== 'MIT');
      case 2: // gitlab
        return !!gitLabForm.projectPath?.trim();
      case 3:
        return !!formData.reuseRequirements?.trim()
          || !!formData.isReuse
          || formData.hasDeploymentAssistant === false
          || formData.showDocker === false
          || formData.showCompose === false
          || formData.showHelm === false
          || !!formData.helmRepo?.trim()
          || !!formData.dockerRepo?.trim()
          || !!formData.customHelmCommand?.trim()
          || !!formData.customComposeCommand?.trim()
          || !!formData.customDockerCommand?.trim()
          || !!formData.customHelmNote?.trim()
          || !!formData.customComposeNote?.trim()
          || !!formData.customDockerNote?.trim()
          || !!formData.customHelmValues?.trim();
      case 4:
        return (formData.liveDemos?.some((demo) => demo.url?.trim()) ?? false)
          || (formData.repositories?.some((repository) => repository.url?.trim()) ?? false)
          || (formData.customLinks?.some((link) => link.url?.trim()) ?? false)
          || !!formData.docsUrl?.trim();
      case 5:
        return !!formData.authority?.trim()
          || (formData.techStack?.length ?? 0) > 0
          || (formData.customFields?.length ?? 0) > 0
          || !!formData.knownIssue?.trim()
          || !!formData.isFeatured;
      case 6:
        return !!formData.markdownContent?.trim();
      default:
        return false;
    }
  };
  const completedCreateStepCount = createSteps.filter((_, index) => isCreateStepCompleted(index)).length;
  const canProceedCreateStep = isCreateStepValid(currentCreateStep);
  const canJumpToCreateStep = (targetIndex: number) => {
    if (targetIndex <= currentCreateStep) return true;
    for (let index = 0; index < targetIndex; index += 1) {
      if (!isCreateStepValid(index)) return false;
    }
    return true;
  };
  const createChecklist = (() => {
    switch (currentCreateStep) {
      case 0:
        return [
          { label: 'Name vergeben', done: !!formData.name?.trim() },
          { label: 'ID verfügbar', done: !!formData.id?.trim() && !isIdTaken },
          { label: 'Mindestens eine Kategorie', done: (formData.categories?.length ?? 0) > 0 },
        ];
      case 1:
        return [
          { label: 'Status festgelegt', done: !!formData.status?.trim() },
          { label: 'Kurzbeschreibung für sichtbare App', done: !requiresExpandedDetails || !!formData.description?.trim() },
          { label: 'Schlagwörter optional', done: (formData.tags?.length ?? 0) > 0 },
        ];
      case 2:
        return [
          { label: 'GitLab-Provider gewählt (optional)', done: !!gitLabForm.providerKey?.trim() },
          { label: 'Projektpfad eingetragen (optional)', done: !!gitLabForm.projectPath?.trim() },
          { label: 'Wird nach Speichern verknüpft', done: !!gitLabForm.projectPath?.trim() },
        ];
      case 3:
        return [
          { label: 'Nachnutzung eingeordnet (optional)', done: formData.isReuse !== undefined },
          { label: 'Deployment Assistant konfiguriert', done: formData.hasDeploymentAssistant !== undefined },
          { label: 'Installationswege gewählt', done: (formData.showDocker !== false) || (formData.showCompose !== false) || (formData.showHelm !== false) },
        ];
      case 4:
        return [
          { label: 'Live-Zugang (optional)', done: !!(formData.liveDemos || []).some((demo) => demo.url?.trim()) },
          { label: 'Repository oder Ressource (optional)', done: (formData.repositories?.length ?? 0) > 0 || (formData.customLinks?.length ?? 0) > 0 || !!formData.docsUrl?.trim() },
          { label: 'Dokumentationslink (optional)', done: !!formData.docsUrl?.trim() },
        ];
      case 5:
        return [
          { label: 'Herausgeber (optional)', done: !!formData.authority?.trim() },
          { label: 'Fachliche Details gepflegt', done: (formData.customFields?.length ?? 0) > 0 },
          { label: 'Bekanntes Problem bei Bedarf', done: !formData.knownIssue || !!formData.knownIssue.trim() },
        ];
      case 6:
        return [
          { label: 'Markdown (optional)', done: !!formData.markdownContent?.trim() },
          { label: 'Entwurf speicherbar', done: canSave },
          { label: 'Bereit für ersten Review', done: requiredDoneCount >= draftRequiredItems.length },
        ];
      default:
        return [];
    }
  })();
  const effectiveAppId = getEffectiveAppId();

  const buildSnapshot = (nextFormData: Partial<AppConfig>) => JSON.stringify({
    appGroupIds: Array.from(appGroupIds).sort(),
    formData: {
      ...nextFormData,
      categories: [...(nextFormData.categories || [])],
      customFields: [...(nextFormData.customFields || [])],
      customLinks: sanitizeLinks(nextFormData.customLinks),
      liveDemos: sanitizeLinks(nextFormData.liveDemos),
      repositories: sanitizeLinks(nextFormData.repositories),
      tags: [...(nextFormData.tags || [])],
      techStack: [...(nextFormData.techStack || [])],
    },
    relatedApps: relatedApps.map((app) => app.id).sort(),
  });

  const createSnapshot = () => buildSnapshot(formData);

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

  if (isNew) {
    return (
      <div className="max-w-6xl mx-auto pb-28">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface-secondary px-5 py-5 shadow-sm md:px-6 md:py-6">
          <div className="absolute inset-0 pointer-events-none opacity-60">
            <div className="absolute -top-16 right-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl animate-pulse" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-gov-gold/15 blur-3xl animate-pulse" />
          </div>

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl space-y-1.5 animate-in fade-in slide-in-from-top-4 duration-500">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted/80">{isCopyFlow ? 'App kopieren' : 'Neue App erstellen'}</p>
                <h1 className="text-2xl font-bold text-foreground">{isCopyFlow ? `Kopie von ${copySource.name} vorbereiten.` : 'Schritt für Schritt zum ersten Entwurf.'}</h1>
                <p className="max-w-xl text-sm leading-relaxed text-muted">
                  {isCopyFlow ? 'Die Inhalte wurden übernommen. Prüfen Sie Name, vergeben Sie eine neue ID und passen Sie den Entwurf vor dem Speichern an.' : 'Weniger Felder pro Schritt, gleicher Datenumfang am Ende.'}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[20rem] xl:max-w-sm xl:flex-1">
                {['Basisdaten', 'Erweiterte Angaben'].map((phase) => {
                  const phaseSteps = createSteps.filter((step) => step.phase === phase);
                  const phaseCompleted = phaseSteps.filter((step) => {
                    const stepIndex = createSteps.findIndex((entry) => entry.id === step.id);
                    return stepIndex >= 0 && isCreateStepCompleted(stepIndex);
                  }).length;
                  const isActivePhase = currentCreatePhase === phase;

                  return (
                    <div
                      key={phase}
                      className={`rounded-2xl border px-3.5 py-3 transition-all duration-300 ${
                        isActivePhase ? 'border-accent/30 bg-accent/10 shadow-sm shadow-accent/10' : 'border-border bg-surface/85'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Phase</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{phase}</p>
                        </div>
                        <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-muted">
                          {phaseCompleted}/{phaseSteps.length}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        {phase === 'Basisdaten'
                          ? 'Identität und Kurzprofil zuerst.'
                          : 'Technik, Links und Details danach.'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {createSteps.map((step, index) => {
                  const isActive = index === currentCreateStep;
                  const isCompleted = !isActive && isCreateStepCompleted(index);
                  const isEnabled = canJumpToCreateStep(index);

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (isEnabled) setCurrentCreateStep(index);
                      }}
                      disabled={!isEnabled}
                      className={`group min-w-[11.5rem] rounded-2xl border px-3.5 py-3 text-left transition-all duration-300 md:min-w-[12.5rem] ${
                        isActive
                          ? 'border-accent bg-accent text-white shadow-lg shadow-accent/20'
                          : isCompleted
                            ? 'border-accent/20 bg-accent/10 text-foreground hover:border-accent/40 hover:bg-accent/15'
                            : 'border-border bg-surface/90 text-foreground hover:border-border/80 disabled:cursor-not-allowed disabled:opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                          isActive
                            ? 'border-white/20 bg-white/15 text-white'
                            : isCompleted
                              ? 'border-accent/20 bg-accent/15 text-accent'
                              : 'border-border bg-surface-secondary text-muted'
                        }`}>
                          {isCompleted ? <Check className="w-4 h-4" /> : step.icon}
                        </span>
                        <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${isActive ? 'text-white/75' : 'text-muted/70'}`}>
                          {index + 1}
                        </span>
                      </div>
                      <p className={`mt-3 text-sm font-semibold ${isActive ? 'text-white' : 'text-foreground'}`}>{step.label}</p>
                      <p className={`mt-1 text-[11px] leading-relaxed ${isActive ? 'text-white/75' : 'text-muted'} ${isActive ? 'block' : 'hidden md:block'}`}>{step.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {isCopyFlow && (
          <section className="mt-4 rounded-[1.5rem] border border-accent/20 bg-accent/5 px-5 py-4 shadow-sm md:px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent/80">Kopie vorbereitet</p>
            <p className="mt-2 text-sm text-foreground">
              Die Vorlage <span className="font-semibold">{copySource.name}</span> wurde als neuer Entwurf übernommen. Beziehungen, GitLab-Verknüpfungen und Systemmetadaten werden nicht mitkopiert.
            </p>
          </section>
        )}

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() => requestNavigation(backUrl)}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted shadow-sm transition-colors hover:bg-surface-secondary hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            Zurück zur Übersicht
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-sm">
              Schritt {currentCreateStep + 1} von {createSteps.length}
            </span>
            <span className="inline-flex rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted shadow-sm">
              Arbeitsstand: {getAppStatusLabel(formData.status || DRAFT_STATUS) || 'Entwurf'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.9fr)]">
          <div
            key={currentCreateStepDef.id}
            className="rounded-[2rem] border border-border bg-surface p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 md:p-8"
          >
            <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  {currentCreateStepDef.icon}
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted/70">{currentCreatePhase}</p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">{currentCreateStepDef.label}</h2>
                  <p className="mt-0.5 text-sm text-muted">{currentCreateStepDef.hint}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                  {completedCreateStepCount} von {createSteps.length} Schritten vorbereitet
                </span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted shadow-sm">
                  Entwurf jederzeit speicherbar
                </span>
              </div>
            </div>

            {currentCreateStep === 0 && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
                  <div className="space-y-4 rounded-3xl border border-accent/15 bg-accent/5 p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent/80">App-Icon</p>
                    <button
                      type="button"
                      onClick={() => setShowIconPicker((value) => !value)}
                      className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-dashed border-accent/30 bg-surface text-6xl shadow-sm transition-all hover:border-accent/50"
                    >
                      {formIconSrc ? (
                        <Image src={formIconSrc} alt="Icon" fill className="object-contain p-4" sizes="320px" unoptimized />
                      ) : (
                        formData.icon || '🏛️'
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                        <Pencil className="w-5 h-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => iconFileInputRef.current?.click()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary"
                      >
                        {uploadingIcon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Bild hochladen
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowIconPicker((value) => !value)}
                        className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
                      >
                        Emoji
                      </button>
                    </div>
                    <input
                      ref={iconFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setUploadingIcon(true);
                        setIconUploadError(null);
                        try {
                          const url = await uploadFile('/upload/logo', file);
                          setFormData((previous) => ({ ...previous, icon: url }));
                          setIconUrlInput(url);
                        } catch {
                          setIconUploadError('Upload fehlgeschlagen');
                        } finally {
                          setUploadingIcon(false);
                          event.target.value = '';
                        }
                      }}
                    />
                    {showIconPicker && (
                      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-6 gap-2">
                          {ICON_OPTIONS.map(({ emoji, label }) => (
                            <button
                              key={emoji}
                              type="button"
                              title={label}
                              onClick={() => {
                                setFormData((previous) => ({ ...previous, icon: emoji }));
                                setIconUrlInput('');
                                setShowIconPicker(false);
                              }}
                              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all ${
                                formData.icon === emoji ? 'border-accent bg-accent/10 shadow-sm scale-105' : 'border-border bg-surface-secondary hover:border-accent/30'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <input
                          className="mt-3 w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-accent"
                          placeholder="Oder Bild-URL: https://..."
                          value={iconUrlInput}
                          onChange={(event) => {
                            setIconUrlInput(event.target.value);
                            if (isImageAssetSource(event.target.value)) {
                              setFormData((previous) => ({ ...previous, icon: event.target.value }));
                            }
                          }}
                        />
                        {iconUploadError && <p className="mt-2 text-xs text-danger">{iconUploadError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField
                        isRequired
                        onChange={(value) => {
                          const nextFormData = { ...formData, name: value };
                          nextFormData.id = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                          setFormData(nextFormData);
                        }}
                      >
                        <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">App Name</Label>
                        <Input value={formData.name || ''} placeholder="z.B. Digi-Sign Pro" className="bg-field-background" />
                      </TextField>
                      <div>
                        <TextField
                          isRequired
                          onChange={(value) => setFormData((previous) => ({ ...previous, id: value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                          isInvalid={isIdTaken}
                        >
                          <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Eindeutige ID</Label>
                          <Input value={formData.id || ''} placeholder="z.B. digi-sign-pro" className="bg-field-background font-mono" />
                        </TextField>
                        <p className={`mt-2 text-xs ${isIdTaken ? 'text-danger' : 'text-muted'}`}>
                          {isIdTaken ? 'Diese ID ist bereits vergeben.' : 'Die ID wird automatisch aus dem Namen vorgeschlagen und bleibt editierbar.'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-surface-secondary/45 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Kategorien</p>
                          <p className="mt-1 text-xs text-muted">Mindestens eine Kategorie ist für die Einordnung erforderlich.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCategoryPicker((value) => !value)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-accent/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent/10"
                        >
                          <Plus className="w-3 h-3" /> Kategorien wählen
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(formData.categories || []).map((category) => (
                          <Chip key={category} size="sm" variant="soft" color="accent" className="text-[11px] uppercase font-bold tracking-wider">
                            {category}
                            <button
                              type="button"
                              onClick={() => setFormData((previous) => ({ ...previous, categories: previous.categories?.filter((entry) => entry !== category) }))}
                              className="ml-1 opacity-60 hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Chip>
                        ))}
                        {(formData.categories?.length ?? 0) === 0 && (
                          <p className="text-sm text-muted">Noch keine Kategorie gesetzt.</p>
                        )}
                      </div>

                      {showCategoryPicker && (
                        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="flex flex-wrap gap-2">
                            {PREDEFINED_CATEGORIES.map((category) => {
                              const isSelected = formData.categories?.includes(category);
                              return (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => {
                                    const currentCategories = formData.categories || [];
                                    setFormData({
                                      ...formData,
                                      categories: isSelected
                                        ? currentCategories.filter((entry) => entry !== category)
                                        : [...currentCategories, category],
                                    });
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                    isSelected ? 'border-accent bg-accent text-white shadow-sm' : 'border-border bg-surface text-muted hover:border-accent/30 hover:text-foreground'
                                  }`}
                                >
                                  {category}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              className="flex-1 rounded-xl border border-border bg-field-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                              placeholder="Eigene Kategorie..."
                              value={categoryInput}
                              onChange={(event) => setCategoryInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && categoryInput.trim()) {
                                  event.preventDefault();
                                  const currentCategories = formData.categories || [];
                                  if (!currentCategories.includes(categoryInput.trim())) {
                                    setFormData({ ...formData, categories: [...currentCategories, categoryInput.trim()] });
                                  }
                                  setCategoryInput('');
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const currentCategories = formData.categories || [];
                                if (categoryInput.trim() && !currentCategories.includes(categoryInput.trim())) {
                                  setFormData({ ...formData, categories: [...currentCategories, categoryInput.trim()] });
                                }
                                setCategoryInput('');
                              }}
                              className="inline-flex items-center justify-center rounded-xl bg-accent px-3 py-2 text-white transition-colors hover:bg-accent/90"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentCreateStep === 1 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-surface-secondary/45 p-5">
                  <p className="text-sm font-semibold text-foreground">Status</p>
                  <p className="mt-1 text-xs text-muted">Ein Entwurf braucht nur Name und ID. Sobald Sie einen weitergehenden Status setzen, wird eine Kurzbeschreibung erwartet.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {PREDEFINED_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData((previous) => ({ ...previous, status }))}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          (formData.status || DRAFT_STATUS) === status
                            ? 'border-accent bg-accent text-white shadow-sm'
                            : 'border-border bg-surface text-muted hover:border-accent/30 hover:text-foreground'
                        }`}
                      >
                        {getAppStatusLabel(status) || status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
                  <div className="rounded-3xl border border-border bg-surface p-5">
                    <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Kurzbeschreibung</Label>
                    <textarea
                      className="min-h-[180px] w-full resize-none rounded-2xl border border-border bg-field-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
                      placeholder="Wofür steht die App? Welche Wirkung hat sie im Alltag?"
                      value={formData.description || ''}
                      onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                      <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Lizenz</Label>
                      <input
                        className="w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
                        placeholder="z.B. MIT oder EUPL"
                        value={formData.license || ''}
                        onChange={(event) => setFormData((previous) => ({ ...previous, license: event.target.value }))}
                      />
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                      <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Schlagwörter</Label>
                      <div className="flex flex-wrap gap-2">
                        {(formData.tags || []).map((tag) => (
                          <Chip key={tag} size="sm" variant="soft" className="text-xs font-medium bg-surface-secondary border border-border">
                            {tag}
                            <button
                              type="button"
                              onClick={() => setFormData((previous) => ({ ...previous, tags: previous.tags?.filter((entry) => entry !== tag) }))}
                              className="ml-1 opacity-60 hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 focus-within:border-accent">
                        <input
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/40"
                          placeholder="Tag hinzufügen..."
                          value={tagInput}
                          onChange={(event) => setTagInput(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ',') && tagInput.trim()) {
                              event.preventDefault();
                              const currentTags = formData.tags || [];
                              if (!currentTags.includes(tagInput.trim())) {
                                setFormData((previous) => ({ ...previous, tags: [...(previous.tags || []), tagInput.trim()] }));
                              }
                              setTagInput('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (tagInput.trim()) {
                              const currentTags = formData.tags || [];
                              if (!currentTags.includes(tagInput.trim())) {
                                setFormData((previous) => ({ ...previous, tags: [...(previous.tags || []), tagInput.trim()] }));
                              }
                              setTagInput('');
                            }
                          }}
                          disabled={!tagInput.trim()}
                          className="inline-flex items-center justify-center rounded-full p-1 text-accent transition-colors hover:bg-accent/10 disabled:opacity-30"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentCreateStep === 2 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-surface-secondary/45 p-5">
                  <p className="text-sm font-semibold text-foreground">GitLab-Repository verknüpfen</p>
                  <p className="mt-1 text-xs text-muted">
                    Optional: Verknüpfen Sie die App mit einem GitLab-Repository. README, Metadaten und Deployment-Dateien können direkt hier importiert werden, bevor Sie die nächsten Schritte ausfüllen.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">GitLab-Provider</label>
                    {creationProviders.length > 0 ? (
                      <select
                        value={gitLabForm.providerKey}
                        onChange={(e) => setGitLabForm((p) => ({ ...p, providerKey: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                      >
                        <option value="">— Provider wählen —</option>
                        {creationProviders.map((provider) => (
                          <option key={provider.key} value={provider.key}>
                            {provider.label} ({provider.baseUrl})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={gitLabForm.providerKey}
                        onChange={(e) => setGitLabForm((p) => ({ ...p, providerKey: e.target.value }))}
                        placeholder="Provider-Schlüssel, z. B. gitlab"
                        className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                      />
                    )}
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Projektpfad</label>
                    <input
                      value={gitLabForm.projectPath}
                      onChange={(e) => setGitLabForm((p) => ({ ...p, projectPath: e.target.value }))}
                      placeholder="gruppe/projekt"
                      className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Branch oder Ref</label>
                    <input
                      value={gitLabForm.branch}
                      onChange={(e) => setGitLabForm((p) => ({ ...p, branch: e.target.value }))}
                      placeholder="leer = Default Branch"
                      className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">README-Pfad</label>
                    <input
                      value={gitLabForm.readmePath}
                      onChange={(e) => setGitLabForm((p) => ({ ...p, readmePath: e.target.value }))}
                      placeholder="optional, z. B. docs/README.md"
                      className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Helm Values Pfad</label>
                    <input
                      value={gitLabForm.helmValuesPath}
                      onChange={(e) => setGitLabForm((p) => ({ ...p, helmValuesPath: e.target.value }))}
                      placeholder="optional, z. B. chart/values.yaml"
                      className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Compose-Datei Pfad</label>
                    <input
                      value={gitLabForm.composeFilePath}
                      onChange={(e) => setGitLabForm((p) => ({ ...p, composeFilePath: e.target.value }))}
                      placeholder="optional, z. B. docker-compose.yml"
                      className="h-10 w-full rounded-xl border border-border bg-field-background px-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreationGitLabSync}
                    disabled={syncingGitLab || !gitLabForm.providerKey?.trim() || !gitLabForm.projectPath?.trim()}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {syncingGitLab ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                    Jetzt synchronisieren
                  </button>
                  {!gitLabForm.projectPath?.trim() && (
                    <p className="text-xs text-muted">Kein Repository angegeben – dieser Schritt wird übersprungen.</p>
                  )}
                </div>

                {gitLabError && (
                  <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">{gitLabError}</div>
                )}

                {gitLabSnapshot && (
                  <div className="rounded-3xl border border-success/20 bg-success/5 p-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-success" />
                        <p className="text-sm font-semibold text-foreground">Synchronisation abgeschlossen – Daten wurden übernommen</p>
                      </div>
                      {gitLabSnapshot.syncedAt && (
                        <span className="text-xs text-muted">{new Date(gitLabSnapshot.syncedAt).toLocaleString('de-DE')}</span>
                      )}
                    </div>
                    <ul className="mt-3 space-y-1 pl-6 text-xs text-muted">
                      {gitLabSnapshot.readmeContent?.trim() && <li>README → Dokumentation</li>}
                      {(gitLabSnapshot.description?.trim() || gitLabSnapshot.topics?.length || gitLabSnapshot.license?.trim()) && <li>Beschreibung, Lizenz, Topics → Kurzprofil</li>}
                      {gitLabSnapshot.projectWebUrl && <li>Repository-Link → Ressourcen</li>}
                      {gitLabSnapshot.helmValuesContent?.trim() && <li>Helm Values → Bereitstellung</li>}
                      {gitLabSnapshot.composeFileContent?.trim() && <li>Compose-Datei → Bereitstellung</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {currentCreateStep === 3 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Nachnutzung</p>
                      <p className="mt-1 text-xs text-muted">Aktivieren Sie diesen Modus, wenn die App als bestehende Lösung mitgenutzt werden kann.</p>
                    </div>
                    <Switch
                      isSelected={formData.isReuse || false}
                      onChange={(value) => setFormData((previous) => ({ ...previous, isReuse: value }))}
                    >
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                  </div>
                  <textarea
                    className="mt-4 min-h-[140px] w-full resize-none rounded-2xl border border-border bg-field-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
                    placeholder="Welche Stellen können die App nachnutzen? Welche Voraussetzungen oder Grenzen gibt es?"
                    value={formData.reuseRequirements || ''}
                    onChange={(event) => setFormData((previous) => ({ ...previous, reuseRequirements: event.target.value }))}
                  />
                </div>

                <div className="rounded-3xl border border-border bg-surface p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">Deployment Assistant</p>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">Wählen Sie, welche Installationswege im Store gezeigt werden sollen. Sie können die technischen Angaben auch später noch pro Weg ergänzen.</p>
                    </div>
                    <Switch
                      isSelected={formData.hasDeploymentAssistant ?? true}
                      onChange={(value) => setFormData((previous) => ({ ...previous, hasDeploymentAssistant: value }))}
                    >
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      { key: 'showHelm', label: 'Helm', description: 'Chart und Values für Kubernetes-basierte Installationen.', icon: <Server className="w-4 h-4" /> },
                      { key: 'showCompose', label: 'Compose', description: 'Mehrere Container mit gemeinsamem Setup.', icon: <Terminal className="w-4 h-4" /> },
                      { key: 'showDocker', label: 'Docker', description: 'Direkter Container-Start für einfache Deployments.', icon: <Terminal className="w-4 h-4" /> },
                    ].map(({ key, label, description, icon }) => {
                      const active = formData[key as keyof AppConfig] !== false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormData((previous) => ({ ...previous, [key]: !previous[key as keyof AppConfig] }))}
                          className={`flex min-h-36 flex-col rounded-[1.75rem] border-2 p-5 text-left transition-all ${
                            active ? 'border-accent bg-accent/6 text-accent shadow-sm shadow-accent/10' : 'border-border bg-surface-secondary/55 text-muted hover:border-border/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${active ? 'border-accent/20 bg-accent/12 text-accent' : 'border-border bg-surface text-muted'}`}>
                              {icon}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? 'border-accent/20 bg-accent/12 text-accent' : 'border-border bg-surface text-muted'}`}>
                              {active ? 'Aktiv' : 'Ausgeblendet'}
                            </span>
                          </div>
                          <div className="mt-5 space-y-2">
                            <p className={`text-xl font-semibold leading-tight ${active ? 'text-accent' : 'text-foreground'}`}>{label}</p>
                            <p className={`text-sm leading-relaxed ${active ? 'text-accent/75' : 'text-muted'}`}>{description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formData.hasDeploymentAssistant !== false && (
                  <div className="space-y-4">
                    {formData.showHelm !== false && (
                      <div className="rounded-3xl border border-border bg-surface-secondary/40 p-5">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Server className="w-4 h-4 text-accent" /> Helm
                          {gitLabSnapshot?.helmValuesContent?.trim() && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              <GitBranch className="h-3 w-3" /> via GitLab
                            </span>
                          )}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, helmRepo: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Helm Repo</Label>
                            <Input value={formData.helmRepo || ''} placeholder="oci://..." className="bg-field-background font-mono text-sm" />
                          </TextField>
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customHelmNote: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Hinweis</Label>
                            <Input value={formData.customHelmNote || ''} placeholder="Zusatz für die Einführung" className="bg-field-background text-sm" />
                          </TextField>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customHelmCommand: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Helm-Kommando</Label>
                            <TextArea value={formData.customHelmCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`helm install ${formData.id || 'app'} repo/${formData.id || 'app'}`} />
                          </TextField>
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customHelmValues: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Values.yaml</Label>
                            <TextArea value={formData.customHelmValues || ''} className="bg-field-background font-mono text-sm" placeholder="image:\n  tag: latest" />
                          </TextField>
                        </div>
                      </div>
                    )}

                    {formData.showCompose !== false && (
                      <div className="rounded-3xl border border-border bg-surface-secondary/40 p-5">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Terminal className="w-4 h-4 text-accent" /> Docker Compose
                          {gitLabSnapshot?.composeFileContent?.trim() && (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              <GitBranch className="h-3 w-3" /> via GitLab
                            </span>
                          )}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customComposeCommand: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Compose-Setup</Label>
                            <TextArea value={formData.customComposeCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`services:\n  ${formData.id || 'app'}:\n    image: ...`} />
                          </TextField>
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customComposeNote: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Hinweis</Label>
                            <Input value={formData.customComposeNote || ''} className="bg-field-background text-sm" placeholder="Netzwerk, Volumes oder Voraussetzungen" />
                          </TextField>
                        </div>
                      </div>
                    )}

                    {formData.showDocker !== false && (
                      <div className="rounded-3xl border border-border bg-surface-secondary/40 p-5">
                        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground"><Terminal className="w-4 h-4 text-accent" /> Docker</div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, dockerRepo: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Docker Image</Label>
                            <Input value={formData.dockerRepo || ''} placeholder="image:latest" className="bg-field-background font-mono text-sm" />
                          </TextField>
                          <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customDockerNote: value }))}>
                            <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Hinweis</Label>
                            <Input value={formData.customDockerNote || ''} className="bg-field-background text-sm" placeholder="Ports, Secrets oder Startparameter" />
                          </TextField>
                        </div>
                        <TextField onChange={(value) => setFormData((previous) => ({ ...previous, customDockerCommand: value }))}>
                          <Label className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-wider text-muted">Docker-Kommando</Label>
                          <TextArea value={formData.customDockerCommand || ''} className="bg-field-background font-mono text-sm" placeholder={`docker run -d --name ${formData.id || 'app'} ...`} />
                        </TextField>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentCreateStep === 4 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-surface-secondary/45 p-5">
                  <p className="text-sm font-semibold text-foreground">Direkte Einstiege</p>
                  <p className="mt-1 text-xs text-muted">Sammeln Sie die wichtigsten Einstiege für Live-Zugänge, Code und weitere Informationen.</p>
                </div>

                <div className="space-y-6">
                  <LinkListEditor
                    title="Live-Zugänge"
                    icon={<ExternalLink className="w-4 h-4 text-muted" />}
                    items={formData.liveDemos || []}
                    onChange={(liveDemosValue) => setFormData((previous) => ({ ...previous, liveDemos: liveDemosValue }))}
                    addLabel="Hinzufügen"
                    placeholderLabel="Produktivumgebung"
                    placeholderUrl="https://..."
                  />
                  <LinkListEditor
                    title="Quellcode"
                    icon={<Github className="w-4 h-4 text-muted" />}
                    items={formData.repositories || []}
                    onChange={(repositoriesValue) => setFormData((previous) => ({ ...previous, repositories: repositoriesValue }))}
                    addLabel="Hinzufügen"
                    placeholderLabel="Repository"
                    placeholderUrl="https://github.com/..."
                  />
                  <LinkListEditor
                    title="Weitere Links"
                    icon={<ExternalLink className="w-4 h-4 text-muted" />}
                    items={formData.customLinks || []}
                    onChange={(customLinksValue) => setFormData((previous) => ({ ...previous, customLinks: customLinksValue }))}
                    addLabel="Hinzufügen"
                    placeholderLabel="Link"
                    placeholderUrl="https://..."
                  />
                  <TextField onChange={(value) => setFormData((previous) => ({ ...previous, docsUrl: value }))}>
                    <Label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Dokumentation URL</Label>
                    <Input value={formData.docsUrl || ''} placeholder="https://docs..." className="bg-field-background font-mono text-sm" />
                  </TextField>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-foreground">Status-Prüfung deaktivieren</span>
                      <p className="text-xs text-muted">Aktivieren, wenn die Live-Links hinter Authentifizierung oder VPN liegen und der Erreichbarkeitscheck immer fehlschlagen würde.</p>
                    </div>
                    <Switch
                      isSelected={formData.skipLinkProbe || false}
                      onChange={(val) => setFormData((previous) => ({ ...previous, skipLinkProbe: val }))}
                    >
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                  </div>
                </div>
              </div>
            )}

            {currentCreateStep === 5 && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                      <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Herausgeber</Label>
                      <input
                        className="w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
                        placeholder="z.B. Firma"
                        value={formData.authority || ''}
                        onChange={(event) => setFormData((previous) => ({ ...previous, authority: event.target.value }))}
                      />
                    </div>

                    <div className="rounded-3xl border border-border bg-surface p-5">
                      <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Technik-Stack</Label>
                      <div className="flex flex-wrap gap-2">
                        {(formData.techStack || []).map((tech) => (
                          <Chip key={tech} size="sm" variant="soft" className="text-xs font-medium bg-surface-secondary border border-border shadow-sm">
                            {tech}
                            <button
                              type="button"
                              onClick={() => setFormData((previous) => ({ ...previous, techStack: previous.techStack?.filter((entry) => entry !== tech) }))}
                              className="ml-1 opacity-60 hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 focus-within:border-accent">
                        <input
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/40"
                          placeholder="Technologie hinzufügen..."
                          value={techInput}
                          onChange={(event) => setTechInput(event.target.value)}
                          onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ',') && techInput.trim()) {
                              event.preventDefault();
                              const currentStack = formData.techStack || [];
                              if (!currentStack.includes(techInput.trim())) {
                                setFormData((previous) => ({ ...previous, techStack: [...(previous.techStack || []), techInput.trim()] }));
                              }
                              setTechInput('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (techInput.trim()) {
                              const currentStack = formData.techStack || [];
                              if (!currentStack.includes(techInput.trim())) {
                                setFormData((previous) => ({ ...previous, techStack: [...(previous.techStack || []), techInput.trim()] }));
                              }
                              setTechInput('');
                            }
                          }}
                          disabled={!techInput.trim()}
                          className="inline-flex items-center justify-center rounded-full p-1 text-accent transition-colors hover:bg-accent/10 disabled:opacity-30"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-border bg-surface p-5">
                      <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-muted">Bekanntes Problem</Label>
                      <textarea
                        className="min-h-[140px] w-full resize-none rounded-2xl border border-border bg-field-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent"
                        placeholder="Optional: bekannte Einschränkungen oder Risiken"
                        value={formData.knownIssue || ''}
                        onChange={(event) => setFormData((previous) => ({ ...previous, knownIssue: event.target.value }))}
                      />
                    </div>

                    {isAdmin && (
                      <div className="rounded-3xl border border-accent/10 bg-accent/5 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Ausgezeichnet</p>
                            <p className="mt-1 text-xs text-muted">Nur für Admins: Empfehlung für hervorgehobene Apps.</p>
                          </div>
                          <Switch
                            isSelected={formData.isFeatured || false}
                            onChange={(value) => setFormData((previous) => ({ ...previous, isFeatured: value }))}
                          >
                            <Switch.Control><Switch.Thumb /></Switch.Control>
                          </Switch>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-sm font-semibold text-foreground">Fachliche Details</p>
                  <p className="mt-1 text-xs text-muted">Nur Felder mit Inhalt erscheinen später in der Detailansicht.</p>
                  <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {metaFields.map((field) => (
                      <div key={field.key} className="rounded-2xl border border-border bg-surface-secondary/40 p-4 transition-colors hover:border-accent/30">
                        <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                          {field.icon && <span className="text-accent">{field.icon}</span>}
                          {field.label}
                        </dt>
                        <dd className="mt-3">
                          <input
                            className="w-full border-b border-transparent bg-transparent pb-1 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted/40 hover:border-accent/30 focus:border-accent"
                            value={field.value}
                            onChange={(event) => {
                              const value = event.target.value;
                              const fields: AppField[] = [...(formData.customFields ?? [])];
                              const index = fields.findIndex((entry) => entry.key === field.key);
                              if (value) {
                                if (index >= 0) fields[index] = { key: field.key, value };
                                else fields.push({ key: field.key, value });
                              } else if (index >= 0) {
                                fields.splice(index, 1);
                              }
                              setFormData((previous) => ({ ...previous, customFields: fields }));
                            }}
                            placeholder={field.label}
                          />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {currentCreateStep === 6 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-border bg-surface-secondary/45 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Markdown für die Detailansicht</p>
                    {gitLabSnapshot?.readmeContent?.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        <GitBranch className="h-3 w-3" /> via GitLab
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">Beschreiben Sie die App ausführlicher. Dieser Schritt bleibt bewusst eigenständig, damit die Dokumentation nicht zwischen andere Angaben gequetscht wird.</p>
                </div>
                <TextField onChange={(value) => setFormData((previous) => ({ ...previous, markdownContent: value }))}>
                  <TextArea
                    value={formData.markdownContent || ''}
                    placeholder={`# ${formData.name || 'App Name'}\n\nBeschreiben Sie die App hier im Detail...\n\n## Features\n\n- Feature 1\n- Feature 2`}
                    className="min-h-[520px] bg-field-background font-mono text-sm"
                  />
                </TextField>

                <div className="rounded-3xl border border-border bg-surface p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-foreground">Verwandte Apps und Gruppen</p>
                    <p className="mt-1 text-xs text-muted">
                      Optional: Verknüpfen Sie die App direkt mit bestehenden Einträgen oder ordnen Sie sie einer Gruppe zu.
                    </p>
                  </div>

                  <RelatedAppsTab
                    showDraftHint={!effectiveAppId}
                    isAdmin={isAdmin}
                    relatedApps={relatedApps}
                    groups={groups}
                    appGroupIds={appGroupIds}
                    relatedSearch={relatedSearch}
                    setRelatedSearch={setRelatedSearch}
                    filteredRelatable={filteredRelatable}
                    addingRelated={addingRelated}
                    newGroupName={newGroupName}
                    setNewGroupName={setNewGroupName}
                    creatingGroup={creatingGroup}
                    onAddRelated={handleAddRelated}
                    onRemoveRelated={handleRemoveRelated}
                    onToggleGroup={handleToggleGroup}
                    onCreateGroup={handleCreateGroup}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
              <div className="relative border-b border-border bg-surface-secondary/60 px-5 py-5">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-accent/10 blur-3xl" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Live-Vorschau</p>
                <div className="relative mt-4 flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface text-3xl shadow-sm">
                    {formIconSrc ? (
                      <Image src={formIconSrc} alt={formData.name || 'App Icon'} width={64} height={64} className="h-full w-full object-contain p-2" unoptimized />
                    ) : (
                      formData.icon || '🏛️'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-foreground">{formData.name || 'Neue App'}</p>
                    <p className="mt-1 text-sm text-muted">{formData.description || 'Kurzbeschreibung folgt in einem der nächsten Schritte.'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Status</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-bold uppercase tracking-wider">
                      {getAppStatusLabel(formData.status || DRAFT_STATUS) || 'Entwurf'}
                    </Chip>
                    {formData.isReuse && (
                      <Chip size="sm" variant="soft" color="warning" className="text-[11px] font-bold uppercase tracking-wider">
                        Nachnutzung
                      </Chip>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Kategorien</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(formData.categories || []).length > 0 ? (
                      (formData.categories || []).map((category) => (
                        <Chip key={category} size="sm" variant="soft" className="text-[11px] font-medium bg-surface-secondary border border-border">
                          {category}
                        </Chip>
                      ))
                    ) : (
                      <p className="text-sm text-muted">Noch keine Kategorien gewählt.</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">ID</p>
                  <p className="mt-2 rounded-xl border border-border bg-surface-secondary px-3 py-2 font-mono text-xs text-foreground">{formData.id || 'wird automatisch erstellt'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-surface px-5 py-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Checkliste</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{currentCreateStepDef.label}</p>
                </div>
                <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-muted">
                  {createChecklist.filter((item) => item.done).length}/{createChecklist.length}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {createChecklist.map((item) => (
                  <div key={item.label} className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm ${item.done ? 'border-success/25 bg-success/10 text-foreground' : 'border-border bg-surface-secondary/45 text-muted'}`}>
                    <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${item.done ? 'bg-success/15 text-success' : 'bg-surface text-muted border border-border'}`}>
                      {item.done ? <Check className="w-3.5 h-3.5" /> : <span className="h-2 w-2 rounded-full bg-current opacity-40" />}
                    </span>
                    <span className="leading-relaxed">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-surface px-5 py-5 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/70">Speicherbereitschaft</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {requiredItems.map((item) => (
                  <div key={item.label} className={`rounded-2xl border px-4 py-3 text-sm ${item.done ? 'border-success/25 bg-success/10 text-foreground' : 'border-border bg-surface-secondary/45 text-muted'}`}>
                    <div className="flex items-center gap-2 font-semibold">
                      {item.done ? <Check className="w-4 h-4 text-success" /> : <div className="h-4 w-4 rounded-full border border-border" />}
                      {item.label}
                    </div>
                    <p className="mt-1 text-xs">{item.done ? 'Erledigt' : 'Für den aktuellen Stand noch offen.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              {hasUnsavedChanges && !saveError && !saveSuccess && (
                <p className="mb-1 truncate text-xs text-muted">
                  Ungespeicherte Änderungen. Erfasste Angaben: <span className="font-semibold">{requiredDoneCount}/{requiredItems.length}</span>
                </p>
              )}
              {!canProceedCreateStep && !saveError && !saveSuccess && (
                <p className="truncate text-xs text-muted">Ergänzen Sie die offenen Punkte in diesem Schritt, bevor Sie weitergehen.</p>
              )}
              {!profileReady && !saveError && !saveSuccess && (
                <p className="truncate text-xs text-muted">Ihr Benutzerprofil wird noch synchronisiert. Speichern ist möglich, sobald die Sitzung bestätigt ist.</p>
              )}
              {saveError && <p className="truncate text-sm font-medium text-danger">{saveError}</p>}
              {saveSuccess && (
                <span className="flex items-center gap-1 text-sm font-medium text-success">
                  <CheckCircle2 className="w-4 h-4" /> Gespeichert!
                </span>
              )}
              {lastAutoSave && !saveError && !saveSuccess && (
                <p className="truncate text-xs text-muted">
                  Auto-gespeichert um {lastAutoSave.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => requestNavigation(backUrl)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => setCurrentCreateStep((step) => Math.max(0, step - 1))}
                disabled={currentCreateStep === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Zurück
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !canSave || !profileReady}
                className="inline-flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent shadow-sm transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Speichert...' : 'Entwurf speichern'}
              </button>
              {currentCreateStep < lastCreateStepIndex ? (
                <button
                  type="button"
                  onClick={() => {
                    if (canProceedCreateStep) {
                      setCurrentCreateStep((step) => Math.min(lastCreateStepIndex, step + 1));
                    }
                  }}
                  disabled={!canProceedCreateStep}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Weiter <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave || !profileReady}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Speichert...' : (isDraft ? 'Entwurf speichern' : 'App speichern')}
                </button>
              )}
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
              disabled={saving || !canSave || !profileReady}
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
              {formIconSrc ? (
                <Image src={formIconSrc} alt="Icon" fill className="object-contain p-2" sizes="(max-width: 768px) 80px, 112px" unoptimized />
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

            {/* Skip link probe toggle — shown directly below the link buttons */}
            <div className="mt-3 flex items-center justify-between gap-4 px-1">
              <p className="text-xs text-muted">
                <span className="font-semibold text-foreground">Status-Prüfung deaktivieren:</span>{' '}
                Aktivieren, wenn die Live-Links hinter Authentifizierung oder VPN liegen.
              </p>
              <Switch
                isSelected={formData.skipLinkProbe || false}
                onChange={(val) => setFormData((p) => ({ ...p, skipLinkProbe: val }))}
              >
                <Switch.Control><Switch.Thumb /></Switch.Control>
              </Switch>
            </div>
          </div>
        </div>

        {/* ── Icon picker panel ── */}
        {showIconPicker && (
          <div className="relative z-10 mt-5 p-4 rounded-2xl bg-surface border border-border shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Icon auswählen</span>
              <Button isIconOnly variant="ghost" size="sm" onPress={() => setShowIconPicker(false)} aria-label="Icon-Auswahl schließen">
                <X className="w-4 h-4" />
              </Button>
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
            <Input
              className="w-full"
              placeholder="Oder Bild-URL: https://..."
              value={iconUrlInput}
              variant="secondary"
              onChange={(e) => {
                setIconUrlInput(e.target.value);
                if (isImageAssetSource(e.target.value)) setFormData((p) => ({ ...p, icon: e.target.value }));
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
              <Button isIconOnly variant="ghost" size="sm" onPress={() => setShowCategoryPicker(false)} aria-label="Kategorien schließen">
                <X className="w-4 h-4" />
              </Button>
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
              <Input
                className="flex-1"
                placeholder="Eigene Kategorie..."
                value={categoryInput}
                variant="secondary"
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
              <Button
                isIconOnly
                size="sm"
                onPress={() => {
                  const c = formData.categories || [];
                  if (categoryInput.trim() && !c.includes(categoryInput.trim())) setFormData({ ...formData, categories: [...c, categoryInput.trim()] });
                  setCategoryInput('');
                }}
                isDisabled={!categoryInput.trim()}
                aria-label="Kategorie hinzufügen"
              >
                <Plus className="w-4 h-4" />
              </Button>
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
                <Input value={formData.authority || ''} placeholder="z.B. Firma" className="bg-field-background h-8 text-sm" />
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
            <Tabs.Tab id="gitlab" className="gap-2 py-3 text-sm font-semibold whitespace-nowrap">
              <GitBranch className="w-4 h-4" />
              GitLab
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

            {/* Versionierung */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface-secondary/40 p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" /> Versionierung
              </span>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, version: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Version</Label>
                <Input value={formData.version || ''} placeholder="z.B. 1.2.3" className="bg-field-background h-8 text-sm font-mono" />
              </TextField>
              <TextField onChange={(val) => setFormData((p) => ({ ...p, changelog: val }))}>
                <Label className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Änderungsprotokoll</Label>
                <TextArea
                  value={formData.changelog || ''}
                  placeholder={`## 1.2.3\n- Änderung 1\n- Fehlerbehebung 2`}
                  className="bg-field-background font-mono text-sm min-h-[160px]"
                />
              </TextField>
            </div>
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
                    placeholder="z.B. Firma"
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
          <DeploymentTab formData={formData} setFormData={setFormData} />
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

        <Tabs.Panel id="gitlab">
          <GitLabTab
            currentApp={formData}
            gitLabIntegration={gitLabIntegration}
            gitLabForm={gitLabForm}
            setGitLabForm={setGitLabForm}
            loadingGitLab={loadingGitLab}
            savingGitLab={savingGitLab}
            syncingGitLab={syncingGitLab}
            gitLabError={gitLabError}
            hasGitLabProviders={hasGitLabProviders}
            gitLabStatus={gitLabStatus}
            gitLabSnapshot={gitLabSnapshot}
            onSave={handleSaveGitLabLink}
            onSync={handleSyncGitLab}
            onDelete={handleDeleteGitLabLink}
            onApprove={handleApproveGitLab}
            onApplyReadme={handleApplyGitLabReadme}
            onApplyMetadata={handleApplyGitLabMetadata}
            onApplyDeployment={handleApplyGitLabDeployment}
          />
        </Tabs.Panel>

        {/* Verwandte Apps + Gruppen tab */}
        <Tabs.Panel id="related">
          <RelatedAppsTab
            showDraftHint={false}
            isAdmin={isAdmin}
            relatedApps={relatedApps}
            groups={groups}
            appGroupIds={appGroupIds}
            relatedSearch={relatedSearch}
            setRelatedSearch={setRelatedSearch}
            filteredRelatable={filteredRelatable}
            addingRelated={addingRelated}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            creatingGroup={creatingGroup}
            onAddRelated={handleAddRelated}
            onRemoveRelated={handleRemoveRelated}
            onToggleGroup={handleToggleGroup}
            onCreateGroup={handleCreateGroup}
          />
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
            {!profileReady && !saveError && !saveSuccess && (
              <p className="text-xs text-muted truncate">
                Ihr Benutzerprofil wird noch synchronisiert. Sobald das Backend die Sitzung bestätigt hat, können Sie speichern.
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
              disabled={saving || !canSave || !profileReady}
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
