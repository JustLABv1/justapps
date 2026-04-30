'use client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AIProviderSettingsPanel } from '@/components/admin/AIProviderSettingsPanel';
import { GitLabProviderAdminSettings } from '@/config/apps';
import { DetailFieldDef, FooterLink, defaultDetailFields, useSettings } from '@/context/SettingsContext';
import { fetchApi, uploadFile } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/assets';
import {
    CUSTOM_BRANDING_PRESET,
    DEFAULT_HERO_TITLE_PRESET,
    DEFAULT_TOP_BAR_PRESET,
    HERO_TITLE_PRESET_OPTIONS,
    TOP_BAR_PRESET_OPTIONS,
    normalizeBrandColorList,
    resolveHeroTitleColors,
    resolveTopBarColors,
    seedCustomBrandColors,
} from '@/lib/branding';
import { AVAILABLE_ICONS } from '@/lib/detailFieldIcons';
import {
    Button,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
    Surface,
    Switch,
    TextField,
    Tooltip
} from '@heroui/react';
import { ArrowDown, ArrowUp, Bot, ExternalLink, GitBranch, Globe, Layers, Loader2, Paintbrush, Pin, Plus, ShieldCheck, SortAsc, SortDesc, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type AdminSettingsSection = 'governance' | 'startseite' | 'branding' | 'inhalte' | 'apps' | 'integrationen' | 'ai';

type AdminSettingsWorkspaceProps = {
  title: string;
  description: string;
  sections: AdminSettingsSection[];
};

type SettingsState = {
  aiEnabled: boolean;
  allowAppSubmissions: boolean;
  requireAuthForAppStore: boolean;
  allowAnonymousAI: boolean;
  showTopBanner: boolean;
  topBannerText: string;
  topBannerType: string;
  detailFields: DetailFieldDef[];
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  accentColor: string;
  heroBadge: string;
  heroTitle: string;
  heroTitlePreset: string;
  heroTitleColors: string[];
  heroSubtitle: string;
  footerText: string;
  footerLinks: FooterLink[];
  showFlagBar: boolean;
  topBarPreset: string;
  topBarColors: string[];
  appSortField: string;
  appSortDirection: string;
  pinnedApps: string[];
  enableLinkProbing: boolean;
};

const defaultState: SettingsState = {
  aiEnabled: true,
  allowAppSubmissions: true,
  requireAuthForAppStore: false,
  allowAnonymousAI: false,
  showTopBanner: false,
  topBannerText: '',
  topBannerType: 'info',
  detailFields: defaultDetailFields,
  storeName: '',
  storeDescription: '',
  logoUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  accentColor: '',
  heroBadge: '',
  heroTitle: '',
  heroTitlePreset: DEFAULT_HERO_TITLE_PRESET,
  heroTitleColors: [],
  heroSubtitle: '',
  footerText: '',
  footerLinks: [],
  showFlagBar: true,
  topBarPreset: DEFAULT_TOP_BAR_PRESET,
  topBarColors: [],
  appSortField: 'name',
  appSortDirection: 'asc',
  pinnedApps: [],
  enableLinkProbing: true,
};

type ProviderDraftState = {
  providerKey: string;
  providerType: 'gitlab' | 'github';
  label: string;
  baseUrl: string;
  token: string;
  namespaceAllowlist: string;
  enabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  defaultReadmePath: string;
  defaultHelmValuesPath: string;
  defaultComposeFilePath: string;
};

const defaultProviderDraft = (): ProviderDraftState => ({
  providerKey: '',
  providerType: 'gitlab',
  label: '',
  baseUrl: 'https://gitlab.com',
  token: '',
  namespaceAllowlist: '',
  enabled: true,
  autoSyncEnabled: true,
  syncIntervalMinutes: 15,
  defaultReadmePath: '',
  defaultHelmValuesPath: '',
  defaultComposeFilePath: '',
});

function defaultBaseUrlForProviderType(providerType: 'gitlab' | 'github'): string {
  return providerType === 'github' ? 'https://github.com' : 'https://gitlab.com';
}

function parseProviderAllowlist(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSettingsState(data: Partial<SettingsState>): SettingsState {
  return {
    ...defaultState,
    ...data,
    detailFields: Array.isArray(data.detailFields) && data.detailFields.length > 0
      ? data.detailFields
      : defaultDetailFields,
    footerLinks: Array.isArray(data.footerLinks)
      ? data.footerLinks
      : [],
    heroTitlePreset: data.heroTitlePreset || DEFAULT_HERO_TITLE_PRESET,
    heroTitleColors: normalizeBrandColorList(data.heroTitleColors),
    topBarPreset: data.topBarPreset || DEFAULT_TOP_BAR_PRESET,
    topBarColors: normalizeBrandColorList(data.topBarColors),
    appSortField: data.appSortField || 'name',
    appSortDirection: data.appSortDirection || 'asc',
    pinnedApps: Array.isArray(data.pinnedApps)
      ? data.pinnedApps
      : [],
  };
}

function PalettePreview({ colors }: { colors: string[] }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full border border-border/70 bg-default">
      {colors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          className="h-full flex-1"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function AdminSettingsWorkspace({ title, description, sections }: AdminSettingsWorkspaceProps) {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [gitLabProviders, setGitLabProviders] = useState<GitLabProviderAdminSettings[]>([]);
  const [createProviderModalOpen, setCreateProviderModalOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderDraftState>(defaultProviderDraft);
  const [providerTokenDrafts, setProviderTokenDrafts] = useState<Record<string, string>>({});
  const [providerToDelete, setProviderToDelete] = useState<GitLabProviderAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'logoDark' | 'favicon' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [gitLabProviderError, setGitLabProviderError] = useState<string | null>(null);
  const [pinnedAppInput, setPinnedAppInput] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoPreviewUrl = resolveAssetUrl(settings.logoUrl);
  const logoDarkPreviewUrl = resolveAssetUrl(settings.logoDarkUrl);
  const faviconPreviewUrl = resolveAssetUrl(settings.faviconUrl);
  const topBarPreviewColors = resolveTopBarColors(settings.topBarPreset, settings.topBarColors);
  const heroTitlePreviewColors = resolveHeroTitleColors(settings.heroTitlePreset, settings.heroTitleColors);
  const visibleSections = new Set(sections);

  const updateBrandColors = (field: 'topBarColors' | 'heroTitleColors', index: number, value: string) => {
    const nextColors = seedCustomBrandColors(settings[field], field === 'topBarColors' ? topBarPreviewColors : heroTitlePreviewColors);
    nextColors[index] = value.trim();
    setSettings({ ...settings, [field]: nextColors });
  };

  const handleTopBarPresetChange = (key: string) => {
    setSettings({
      ...settings,
      topBarPreset: key,
      topBarColors: key === CUSTOM_BRANDING_PRESET
        ? seedCustomBrandColors(settings.topBarColors, topBarPreviewColors)
        : settings.topBarColors,
    });
  };

  const handleHeroTitlePresetChange = (key: string) => {
    setSettings({
      ...settings,
      heroTitlePreset: key,
      heroTitleColors: key === CUSTOM_BRANDING_PRESET
        ? seedCustomBrandColors(settings.heroTitleColors, heroTitlePreviewColors)
        : settings.heroTitleColors,
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'logoDarkUrl' | 'faviconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = field === 'logoUrl' ? 'logo' : field === 'logoDarkUrl' ? 'logoDark' : 'favicon';
    setUploading(key as 'logo' | 'logoDark' | 'favicon');
    setUploadError(null);
    try {
      const url = await uploadFile('/upload/logo', file);
      setSettings(prev => ({ ...prev, [field]: url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const fetchRepositoryProviders = async (): Promise<GitLabProviderAdminSettings[]> => {
    const res = await fetchApi('/settings/repository-providers');
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error((error as { message?: string }).message || 'Repository-Provider konnten nicht geladen werden.');
    }

    const providersData = await res.json() as GitLabProviderAdminSettings[];
    return Array.isArray(providersData) ? providersData : [];
  };

  const loadRepositoryProviders = async () => {
    const providersData = await fetchRepositoryProviders();
    setGitLabProviders(Array.isArray(providersData) ? providersData : []);
    setGitLabProviderError(null);
  };

  useEffect(() => {
    Promise.all([
      fetchApi('/settings').then(res => res.ok ? res.json() : null),
      fetchRepositoryProviders(),
    ])
      .then(([settingsData, providersData]) => {
        if (settingsData) setSettings(normalizeSettingsState(settingsData));
        setGitLabProviders(providersData);
        setGitLabProviderError(null);
      })
      .catch((error) => {
        setGitLabProviderError(error instanceof Error ? error.message : 'Repository-Provider konnten nicht geladen werden.');
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<SettingsState>, sectionKey: string) => {
    const updated = { ...settings, ...patch };
    setSaving(true);
    try {
      const res = await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setSettings(updated);
        await refreshSettings();
        setSavedSection(sectionKey);
        setTimeout(() => setSavedSection(null), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateGitLabProvider = (providerKey: string, patch: Partial<GitLabProviderAdminSettings>) => {
    setGitLabProviders((prev) => prev.map((provider) => (
      provider.providerKey === providerKey ? { ...provider, ...patch } : provider
    )));
  };

  const updateProviderTokenDraft = (providerKey: string, value: string) => {
    setProviderTokenDrafts((prev) => ({ ...prev, [providerKey]: value }));
  };

  const closeCreateProviderModal = () => {
    setCreateProviderModalOpen(false);
    setNewProvider(defaultProviderDraft());
  };

  const createGitLabProvider = async () => {
    setSaving(true);
    setGitLabProviderError(null);
    try {
      const res = await fetchApi('/settings/repository-providers', {
        method: 'POST',
        body: JSON.stringify({
          providerKey: newProvider.providerKey.trim(),
          providerType: newProvider.providerType,
          label: newProvider.label,
          baseUrl: newProvider.baseUrl.trim(),
          token: newProvider.token,
          namespaceAllowlist: parseProviderAllowlist(newProvider.namespaceAllowlist),
          enabled: newProvider.enabled,
          autoSyncEnabled: newProvider.autoSyncEnabled,
          syncIntervalMinutes: newProvider.syncIntervalMinutes,
          defaultReadmePath: newProvider.defaultReadmePath,
          defaultHelmValuesPath: newProvider.defaultHelmValuesPath,
          defaultComposeFilePath: newProvider.defaultComposeFilePath,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message || 'Repository-Provider konnte nicht erstellt werden.');
      }

      await loadRepositoryProviders();
      closeCreateProviderModal();
      setSavedSection('gitlab-create');
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(error instanceof Error ? error.message : 'Repository-Provider konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  };

  const saveGitLabProvider = async (provider: GitLabProviderAdminSettings, options?: { clearToken?: boolean }) => {
    setSaving(true);
    setGitLabProviderError(null);
    try {
      const tokenDraft = providerTokenDrafts[provider.providerKey]?.trim() || '';
      const res = await fetchApi(`/settings/repository-providers/${provider.providerKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: provider.label,
          baseUrl: provider.baseUrl,
          token: options?.clearToken ? '' : tokenDraft,
          clearToken: options?.clearToken ?? false,
          namespaceAllowlist: provider.namespaceAllowlist,
          enabled: provider.enabled,
          autoSyncEnabled: provider.autoSyncEnabled,
          syncIntervalMinutes: provider.syncIntervalMinutes,
          defaultReadmePath: provider.defaultReadmePath,
          defaultHelmValuesPath: provider.defaultHelmValuesPath,
          defaultComposeFilePath: provider.defaultComposeFilePath,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message || 'Repository-Provider konnte nicht gespeichert werden.');
      }

      await loadRepositoryProviders();
      setProviderTokenDrafts((prev) => {
        const next = { ...prev };
        delete next[provider.providerKey];
        return next;
      });
      setSavedSection(`gitlab-${provider.providerKey}`);
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(error instanceof Error ? error.message : 'Repository-Provider konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const deleteGitLabProvider = async () => {
    if (!providerToDelete) return;

    setSaving(true);
    setGitLabProviderError(null);
    try {
      const res = await fetchApi(`/settings/repository-providers/${providerToDelete.providerKey}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message || 'Repository-Provider konnte nicht gelöscht werden.');
      }

      await loadRepositoryProviders();
      setProviderToDelete(null);
      setSavedSection('gitlab-delete');
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(error instanceof Error ? error.message : 'Repository-Provider konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="py-20 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted max-w-3xl">{description}</p>
      </div>

      <div className="flex flex-col gap-6">

        {visibleSections.has('governance') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" /> Einreichungen
              </h3>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">App-Einreichungen erlauben</span>
                  <p className="text-xs text-muted max-w-xs">Geben Sie Benutzern die Freiheit, eigene Apps vorzuschlagen.</p>
                </div>
                <Switch
                  isSelected={settings.allowAppSubmissions}
                  onChange={(val) => save({ allowAppSubmissions: val }, 'submissions')}
                >
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border pt-5 mt-5">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">App Store nur für angemeldete Nutzer</span>
                  <p className="text-xs text-muted max-w-xl">
                    Blockiert den öffentlichen Zugriff auf Katalog, App-Details und Gruppen und leitet Besucher direkt zur Anmeldung weiter.
                  </p>
                </div>
                <Switch
                  isSelected={settings.requireAuthForAppStore}
                  onChange={(val) => save({ requireAuthForAppStore: val }, 'requireAuthForAppStore')}
                >
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>
            </Surface>
          </div>
        )}

        {visibleSections.has('startseite') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" /> Top Banner
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 items-end">
                  <TextField
                    className="flex-grow"
                    value={settings.topBannerText}
                    onChange={(val) => setSettings({ ...settings, topBannerText: val })}
                  >
                    <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Banner Text</Label>
                    <Input placeholder="Ankuendigung hier eingeben..." className="bg-field-background" />
                  </TextField>
                  <Button
                    size="sm"
                    className="bg-accent text-white"
                    isDisabled={saving}
                    onPress={() => save({ topBannerText: settings.topBannerText, topBannerType: settings.topBannerType }, 'banner')}
                  >
                    {savedSection === 'banner' ? 'Gespeichert ✓' : 'Speichern'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">Typ</span>
                  <Select
                    selectedKey={settings.topBannerType || 'info'}
                    onSelectionChange={(key) => setSettings({ ...settings, topBannerType: String(key) })}
                    className="w-40"
                    aria-label="Banner-Typ"
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="info">Info</ListBox.Item>
                        <ListBox.Item id="warning">Warnung</ListBox.Item>
                        <ListBox.Item id="critical">Kritisch</ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">Status</span>
                  <Switch
                    isSelected={settings.showTopBanner}
                    onChange={(val) => save({ showTopBanner: val }, 'bannerToggle')}
                  >
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>
              </div>
            </Surface>

            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" /> Hero & Footer
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={settings.heroBadge}
                  onChange={(val) => setSettings({ ...settings, heroBadge: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Hero Badge</Label>
                  <Input placeholder="Open Source. Community-getrieben." className="bg-field-background" />
                </TextField>
                <TextField
                  value={settings.heroTitle}
                  onChange={(val) => setSettings({ ...settings, heroTitle: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Hero Titel</Label>
                  <Input placeholder="Der App Store fuer alle." className="bg-field-background" />
                </TextField>
                <TextField
                  className="md:col-span-2"
                  value={settings.heroSubtitle}
                  onChange={(val) => setSettings({ ...settings, heroSubtitle: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Hero Untertitel</Label>
                  <Input placeholder="Entdecken Sie Open-Source-Apps, cloud-native Loesungen..." className="bg-field-background" />
                </TextField>
                <TextField
                  className="md:col-span-2"
                  value={settings.footerText}
                  onChange={(val) => setSettings({ ...settings, footerText: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Footer Text</Label>
                  <Input placeholder="Die Plattform fuer moderne, souveraene Software-Loesungen..." className="bg-field-background" />
                </TextField>
                <div className="md:col-span-2 flex items-center justify-between border-t border-border pt-4 mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Farbbalken oben anzeigen</span>
                    <p className="text-xs text-muted">Zeigt einen schmalen Farbbalken am oberen Seitenrand.</p>
                  </div>
                  <Switch
                    isSelected={settings.showFlagBar}
                    onChange={(val) => setSettings({ ...settings, showFlagBar: val })}
                  >
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>
                <div className="md:col-span-2 grid gap-4 rounded-2xl border border-border/60 bg-surface-secondary/60 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                    <Select
                      selectedKey={settings.topBarPreset}
                      onSelectionChange={(key) => handleTopBarPresetChange(String(key))}
                    >
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Preset fuer den oberen Balken</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {TOP_BAR_PRESET_OPTIONS.map((option) => (
                            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                              <div className="flex flex-col gap-0.5 py-0.5">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted">{option.description}</span>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Vorschau</span>
                      <PalettePreview colors={topBarPreviewColors} />
                    </div>
                  </div>
                  {settings.topBarPreset === CUSTOM_BRANDING_PRESET && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {topBarPreviewColors.map((color, index) => (
                        <div key={`top-bar-color-${index}`} className="flex items-end gap-2">
                          <div className="mb-0.5 h-10 w-10 shrink-0 rounded-lg border border-border" style={{ backgroundColor: color || 'transparent' }} />
                          <TextField
                            className="flex-1"
                            value={settings.topBarColors[index] || ''}
                            onChange={(val) => updateBrandColors('topBarColors', index, val)}
                          >
                            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Balkenfarbe {index + 1}</Label>
                            <Input placeholder="#004B76" className="bg-field-background font-mono text-sm" />
                          </TextField>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 grid gap-4 rounded-2xl border border-border/60 bg-surface-secondary/60 p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                    <Select
                      selectedKey={settings.heroTitlePreset}
                      onSelectionChange={(key) => handleHeroTitlePresetChange(String(key))}
                    >
                      <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Preset fuer die Hero-Titel-Farben</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {HERO_TITLE_PRESET_OPTIONS.map((option) => (
                            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                              <div className="flex flex-col gap-0.5 py-0.5">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted">{option.description}</span>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Vorschau</span>
                      <div className="rounded-xl border border-border/70 bg-surface px-4 py-3">
                        <p
                          className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent"
                          style={{ backgroundImage: `linear-gradient(90deg, ${heroTitlePreviewColors.join(', ')})` }}
                        >
                          {settings.heroTitle || 'Der App Store fuer alle.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  {settings.heroTitlePreset === CUSTOM_BRANDING_PRESET && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {heroTitlePreviewColors.map((color, index) => (
                        <div key={`hero-title-color-${index}`} className="flex items-end gap-2">
                          <div className="mb-0.5 h-10 w-10 shrink-0 rounded-lg border border-border" style={{ backgroundColor: color || 'transparent' }} />
                          <TextField
                            className="flex-1"
                            value={settings.heroTitleColors[index] || ''}
                            onChange={(val) => updateBrandColors('heroTitleColors', index, val)}
                          >
                            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Titelfarbe {index + 1}</Label>
                            <Input placeholder="#004B76" className="bg-field-background font-mono text-sm" />
                          </TextField>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({
                    heroBadge: settings.heroBadge,
                    heroTitle: settings.heroTitle,
                    heroTitlePreset: settings.heroTitlePreset,
                    heroTitleColors: settings.heroTitleColors,
                    heroSubtitle: settings.heroSubtitle,
                    footerText: settings.footerText,
                    showFlagBar: settings.showFlagBar,
                    topBarPreset: settings.topBarPreset,
                    topBarColors: settings.topBarColors,
                  }, 'homepage')}
                >
                  {savedSection === 'homepage' ? 'Gespeichert ✓' : 'Startseite speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        )}

        {visibleSections.has('branding') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-accent" /> Erscheinungsbild
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  value={settings.storeName}
                  onChange={(val) => setSettings({ ...settings, storeName: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Store Name</Label>
                  <Input placeholder="JustApps" className="bg-field-background" />
                </TextField>
                <TextField
                  value={settings.accentColor}
                  onChange={(val) => setSettings({ ...settings, accentColor: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Akzentfarbe (CSS-Wert)</Label>
                  <Input placeholder="#004B76 oder oklch(0.42 0.12 245)" className="bg-field-background" />
                </TextField>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Logo (Hell-Modus)</Label>
                  <div className="flex gap-2 items-center">
                    {logoPreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreviewUrl} alt="Logo Preview" className="h-8 w-8 rounded object-contain border border-border bg-surface shrink-0" />
                    )}
                    <TextField value={settings.logoUrl} onChange={(val) => setSettings({ ...settings, logoUrl: val })} className="flex-1">
                      <Input placeholder="https://example.com/logo.png" className="bg-field-background" />
                    </TextField>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'logoUrl')} />
                    <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" isDisabled={uploading === 'logo'} onPress={() => logoInputRef.current?.click()}>
                      {uploading === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading === 'logo' ? 'Laedt...' : 'Upload'}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Logo (Dunkel-Modus)</Label>
                  <div className="flex gap-2 items-center">
                    {logoDarkPreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoDarkPreviewUrl} alt="Logo Dark Preview" className="h-8 w-8 rounded object-contain border border-border bg-[#1a1a1a] shrink-0" />
                    )}
                    <TextField value={settings.logoDarkUrl} onChange={(val) => setSettings({ ...settings, logoDarkUrl: val })} className="flex-1">
                      <Input placeholder="https://example.com/logo-dark.png" className="bg-field-background" />
                    </TextField>
                    <input ref={logoDarkInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'logoDarkUrl')} />
                    <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" isDisabled={uploading === 'logoDark'} onPress={() => logoDarkInputRef.current?.click()}>
                      {uploading === 'logoDark' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading === 'logoDark' ? 'Laedt...' : 'Upload'}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Favicon</Label>
                  <div className="flex gap-2 items-center">
                    {faviconPreviewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={faviconPreviewUrl} alt="Favicon Preview" className="h-8 w-8 rounded object-contain border border-border bg-surface shrink-0" />
                    )}
                    <TextField value={settings.faviconUrl} onChange={(val) => setSettings({ ...settings, faviconUrl: val })} className="flex-1">
                      <Input placeholder="https://example.com/favicon.ico" className="bg-field-background" />
                    </TextField>
                    <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'faviconUrl')} />
                    <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" isDisabled={uploading === 'favicon'} onPress={() => faviconInputRef.current?.click()}>
                      {uploading === 'favicon' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading === 'favicon' ? 'Laedt...' : 'Upload'}
                    </Button>
                  </div>
                </div>
                <TextField
                  className="md:col-span-2"
                  value={settings.storeDescription}
                  onChange={(val) => setSettings({ ...settings, storeDescription: val })}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Store Beschreibung (SEO / Metadata)</Label>
                  <Input placeholder="Zentraler App Store fuer Softwareloesungen..." className="bg-field-background" />
                </TextField>
              </div>
              {uploadError && (
                <p className="mt-3 text-xs text-danger font-medium">{uploadError}</p>
              )}
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving || uploading !== null}
                  onPress={() => save({
                    storeName: settings.storeName,
                    storeDescription: settings.storeDescription,
                    logoUrl: settings.logoUrl,
                    logoDarkUrl: settings.logoDarkUrl,
                    faviconUrl: settings.faviconUrl,
                    accentColor: settings.accentColor,
                  }, 'branding')}
                >
                  {savedSection === 'branding' ? 'Gespeichert ✓' : 'Erscheinungsbild speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        )}

        {visibleSections.has('inhalte') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Fachliche Details — Felder
              </h3>
              <p className="text-xs text-muted mb-5">Definieren Sie, welche Felder im Tab &quot;Fachliche Details&quot; einer App angezeigt und bearbeitet werden koennen. Reihenfolge, Label und Schluessel sind frei konfigurierbar.</p>

              <div className="flex flex-col gap-2 mb-4">
                {settings.detailFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface/50 border border-border rounded-xl p-2.5">
                    <div className="flex flex-col gap-1 flex-1 md:flex-row md:gap-3">
                      <div className="flex flex-col gap-1 shrink-0">
                        <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">Icon</Label>
                        <div className="flex flex-wrap gap-1 p-1.5 bg-field-background border border-border rounded-lg w-full md:w-56 max-h-24 overflow-y-auto">
                          {AVAILABLE_ICONS.map(({ name, component }) => (
                            <Tooltip key={name} delay={0}>
                              <Tooltip.Trigger>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fields = [...settings.detailFields];
                                    fields[idx] = { ...fields[idx], icon: name };
                                    setSettings({ ...settings, detailFields: fields });
                                  }}
                                  className={`p-1 rounded transition-colors ${field.icon === name ? 'bg-accent text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
                                >
                                  {component}
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>{name}</Tooltip.Content>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 flex-1">
                        <TextField
                          value={field.label}
                          onChange={(val) => {
                            const fields = [...settings.detailFields];
                            fields[idx] = { ...fields[idx], label: val };
                            setSettings({ ...settings, detailFields: fields });
                          }}
                        >
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">Bezeichnung</Label>
                          <Input placeholder="z.B. Themenfeld" className="bg-field-background" />
                        </TextField>
                        <TextField
                          value={field.key}
                          onChange={(val) => {
                            const fields = [...settings.detailFields];
                            fields[idx] = { ...fields[idx], key: val.toLowerCase().replace(/\s+/g, '_') };
                            setSettings({ ...settings, detailFields: fields });
                          }}
                        >
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">Schluessel (intern)</Label>
                          <Input placeholder="z.B. focus" className="bg-field-background font-mono text-sm" />
                        </TextField>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        isDisabled={idx === 0}
                        onPress={() => {
                          const fields = [...settings.detailFields];
                          [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
                          setSettings({ ...settings, detailFields: fields });
                        }}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        isDisabled={idx === settings.detailFields.length - 1}
                        onPress={() => {
                          const fields = [...settings.detailFields];
                          [fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]];
                          setSettings({ ...settings, detailFields: fields });
                        }}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 w-9 p-0 text-danger shrink-0"
                      onPress={() => {
                        const fields = settings.detailFields.filter((_, i) => i !== idx);
                        setSettings({ ...settings, detailFields: fields });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onPress={() => {
                    const fields = [...settings.detailFields, { key: '', label: '' }];
                    setSettings({ ...settings, detailFields: fields });
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Feld hinzufuegen
                </Button>
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({ detailFields: settings.detailFields }, 'detailFields')}
                >
                  {savedSection === 'detailFields' ? 'Gespeichert ✓' : 'Felder speichern'}
                </Button>
              </div>
            </Surface>

            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-accent" /> Footer — Links
              </h3>
              <p className="text-xs text-muted mb-5">Konfigurieren Sie die Links im Footer (z.B. Impressum, Datenschutz). Ohne Eintraege werden die Standardlinks angezeigt.</p>

              <div className="flex flex-col gap-2 mb-4">
                {settings.footerLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface/50 border border-border rounded-xl p-2.5">
                    <div className="flex flex-col gap-3 flex-1 md:flex-row md:gap-3">
                      <TextField
                        className="flex-1"
                        value={link.label}
                        onChange={(val) => {
                          const links = [...settings.footerLinks];
                          links[idx] = { ...links[idx], label: val };
                          setSettings({ ...settings, footerLinks: links });
                        }}
                      >
                        <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">Bezeichnung</Label>
                        <Input placeholder="z.B. Impressum" className="bg-field-background" />
                      </TextField>
                      <TextField
                        className="flex-1"
                        value={link.url}
                        onChange={(val) => {
                          const links = [...settings.footerLinks];
                          links[idx] = { ...links[idx], url: val };
                          setSettings({ ...settings, footerLinks: links });
                        }}
                      >
                        <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">URL</Label>
                        <Input placeholder="https://example.com/impressum" className="bg-field-background font-mono text-sm" />
                      </TextField>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-9 w-9 p-0 text-danger shrink-0 self-end mb-0.5"
                      onPress={() => {
                        const links = settings.footerLinks.filter((_, i) => i !== idx);
                        setSettings({ ...settings, footerLinks: links });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onPress={() => {
                    const links = [...settings.footerLinks, { label: '', url: '' }];
                    setSettings({ ...settings, footerLinks: links });
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Link hinzufuegen
                </Button>
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({ footerLinks: settings.footerLinks }, 'footerLinks')}
                >
                  {savedSection === 'footerLinks' ? 'Gespeichert ✓' : 'Links speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        )}

        {visibleSections.has('apps') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-accent" /> App-Sortierung
              </h3>
              <p className="text-xs text-muted mb-5">Legen Sie fest, nach welchem Kriterium Apps standardmaessig sortiert werden und welche Apps immer oben erscheinen.</p>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Select
                    className="flex-1"
                    selectedKey={settings.appSortField}
                    onSelectionChange={(key) => setSettings({ ...settings, appSortField: String(key) })}
                  >
                    <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Sortierfeld</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="name" textValue="Name (A–Z)">Name (A–Z)<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="rating_avg" textValue="Bewertung">Bewertung<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="updated_at" textValue="Zuletzt aktualisiert">Zuletzt aktualisiert<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="status" textValue="Status">Status<ListBox.ItemIndicator /></ListBox.Item>
                        <ListBox.Item id="authority" textValue="Herausgeber">Herausgeber<ListBox.ItemIndicator /></ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Richtung</Label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={settings.appSortDirection === 'asc' ? 'primary' : 'secondary'}
                        className={`gap-1.5 ${settings.appSortDirection === 'asc' ? 'bg-accent text-white' : ''}`}
                        onPress={() => setSettings({ ...settings, appSortDirection: 'asc' })}
                      >
                        <SortAsc className="w-3.5 h-3.5" /> Aufsteigend
                      </Button>
                      <Button
                        size="sm"
                        variant={settings.appSortDirection === 'desc' ? 'primary' : 'secondary'}
                        className={`gap-1.5 ${settings.appSortDirection === 'desc' ? 'bg-accent text-white' : ''}`}
                        onPress={() => setSettings({ ...settings, appSortDirection: 'desc' })}
                      >
                        <SortDesc className="w-3.5 h-3.5" /> Absteigend
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Pin className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">Angepinnte Apps</span>
                  </div>
                  <p className="text-xs text-muted mb-3">Apps-IDs, die unabhaengig von der Sortierung immer an erster Stelle angezeigt werden. Reihenfolge entspricht der Anzeigereihenfolge.</p>

                  <div className="flex flex-col gap-2 mb-3">
                    {settings.pinnedApps.length === 0 && (
                      <p className="text-xs text-muted/60 italic">Keine Apps angepinnt.</p>
                    )}
                    {settings.pinnedApps.map((appId, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-surface/50 border border-border rounded-lg px-3 py-2">
                        <Pin className="w-3 h-3 text-accent shrink-0" />
                        <span className="flex-1 text-sm font-mono truncate">{appId}</span>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 p-0"
                            isDisabled={idx === 0}
                            onPress={() => {
                              const pins = [...settings.pinnedApps];
                              [pins[idx - 1], pins[idx]] = [pins[idx], pins[idx - 1]];
                              setSettings({ ...settings, pinnedApps: pins });
                            }}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 p-0"
                            isDisabled={idx === settings.pinnedApps.length - 1}
                            onPress={() => {
                              const pins = [...settings.pinnedApps];
                              [pins[idx], pins[idx + 1]] = [pins[idx + 1], pins[idx]];
                              setSettings({ ...settings, pinnedApps: pins });
                            }}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 w-6 p-0 text-danger"
                            onPress={() => {
                              const pins = settings.pinnedApps.filter((_, i) => i !== idx);
                              setSettings({ ...settings, pinnedApps: pins });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <TextField
                      className="flex-1"
                      value={pinnedAppInput}
                      onChange={(val) => setPinnedAppInput(val)}
                    >
                      <Input placeholder="App-ID eingeben (z.B. nextcloud)" className="bg-field-background font-mono text-sm" />
                    </TextField>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 shrink-0"
                      isDisabled={!pinnedAppInput.trim() || settings.pinnedApps.includes(pinnedAppInput.trim())}
                      onPress={() => {
                        const id = pinnedAppInput.trim();
                        if (id && !settings.pinnedApps.includes(id)) {
                          setSettings({ ...settings, pinnedApps: [...settings.pinnedApps, id] });
                          setPinnedAppInput('');
                        }
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Hinzufuegen
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({
                    appSortField: settings.appSortField,
                    appSortDirection: settings.appSortDirection,
                    pinnedApps: settings.pinnedApps,
                  }, 'sort')}
                >
                  {savedSection === 'sort' ? 'Gespeichert ✓' : 'Sortierung speichern'}
                </Button>
              </div>
            </Surface>

            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-accent" /> Link-Status-Prüfung
              </h3>
              <p className="text-xs text-muted mb-5">
                Wenn aktiviert, wird die Erreichbarkeit von Live-Demo-Links serverseitig geprüft und ein farbiger Status-Punkt angezeigt. Einzelne Apps können die Prüfung über ihre eigene Einstellung deaktivieren (z.B. bei Links hinter Authentifizierung).
              </p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Status-Prüfung aktivieren</span>
                  <p className="text-xs text-muted max-w-xs">Zeigt einen Erreichbarkeits-Indikator neben Live-Demo-Links an.</p>
                </div>
                <Switch
                  isSelected={settings.enableLinkProbing}
                  onChange={(val) => setSettings({ ...settings, enableLinkProbing: val })}
                >
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                </Switch>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({ enableLinkProbing: settings.enableLinkProbing }, 'linkProbing')}
                >
                  {savedSection === 'linkProbing' ? 'Gespeichert ✓' : 'Speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        )}

        {visibleSections.has('integrationen') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent" /> Repository-Provider
              </h3>
              <p className="text-xs text-muted mb-5">
                Verwalten Sie hier Repository-Provider vollständig in der Datenbank. Tokens werden verschlüsselt gespeichert und nach dem Speichern nicht mehr angezeigt.
              </p>

              {gitLabProviderError && (
                <div className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {gitLabProviderError}
                </div>
              )}

              <div className="mb-5 rounded-2xl border border-dashed border-border bg-surface-secondary/35 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Neuen Repository-Provider anlegen</p>
                    <p className="mt-1 text-xs text-muted">Der Formular-Dialog hält die Integrationsseite kompakt. Schlüssel, Typ und Token werden dort beim Erstellen festgelegt.</p>
                  </div>
                  <Button
                    className="bg-accent text-white"
                    onPress={() => setCreateProviderModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    {savedSection === 'gitlab-create' ? 'Provider erstellt ✓' : 'Neuen Provider anlegen'}
                  </Button>
                </div>
              </div>

              {gitLabProviders.length === 0 ? (
                <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning">
                  Es sind aktuell keine Repository-Provider in der Datenbank konfiguriert.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {gitLabProviders.map((provider) => (
                    <div key={provider.providerKey} className="rounded-2xl border border-border bg-surface p-5">
                      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{provider.providerKey}</p>
                            {provider.providerType && (
                              <span className="inline-flex rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                                {provider.providerType === 'github' ? 'GitHub' : provider.providerType === 'gitlab' ? 'GitLab' : provider.providerType}
                              </span>
                            )}
                            {(provider.linkedAppsCount || 0) > 0 && (
                              <span className="inline-flex rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                                {provider.linkedAppsCount} App-Verknüpfungen
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {provider.tokenConfigured ? 'Token verschlüsselt in der Datenbank gespeichert' : 'Kein Token gespeichert'}
                            {provider.configured ? ' · Provider aktiv konfiguriert' : ' · Provider derzeit nicht vollständig nutzbar'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${provider.enabled ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-surface-secondary text-muted'}`}>
                            {provider.enabled ? 'Aktiv' : 'Deaktiviert'}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${provider.autoSyncEnabled ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border bg-surface-secondary text-muted'}`}>
                            {provider.autoSyncEnabled ? 'Auto-Sync an' : 'Auto-Sync aus'}
                          </span>
                          <Tooltip delay={0}>
                            <Tooltip.Trigger>
                              <div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 w-8 p-0 text-danger"
                                  isDisabled={saving || (provider.linkedAppsCount || 0) > 0}
                                  onPress={() => setProviderToDelete(provider)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </Tooltip.Trigger>
                            <Tooltip.Content>
                              {(provider.linkedAppsCount || 0) > 0
                                ? 'Verknüpfte Apps zuerst lösen, bevor der Provider gelöscht werden kann.'
                                : 'Provider löschen'}
                            </Tooltip.Content>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TextField value={provider.label} onChange={(val) => updateGitLabProvider(provider.providerKey, { label: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Bezeichnung</Label>
                          <Input placeholder="z. B. interne Forge oder GitHub.com" className="bg-field-background" />
                        </TextField>

                        <TextField value={provider.baseUrl} onChange={(val) => updateGitLabProvider(provider.providerKey, { baseUrl: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Base URL</Label>
                          <Input placeholder="https://gitlab.example.org oder https://github.com" className="bg-field-background font-mono text-sm" />
                        </TextField>

                        <TextField value={provider.defaultReadmePath || ''} onChange={(val) => updateGitLabProvider(provider.providerKey, { defaultReadmePath: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard README-Pfad</Label>
                          <Input placeholder="optional, z. B. docs/README.md" className="bg-field-background font-mono text-sm" />
                        </TextField>

                        <TextField value={provider.defaultHelmValuesPath || ''} onChange={(val) => updateGitLabProvider(provider.providerKey, { defaultHelmValuesPath: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard Helm Values</Label>
                          <Input placeholder="chart/values.yaml" className="bg-field-background font-mono text-sm" />
                        </TextField>

                        <TextField value={provider.defaultComposeFilePath || ''} onChange={(val) => updateGitLabProvider(provider.providerKey, { defaultComposeFilePath: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard Compose-Datei</Label>
                          <Input placeholder="docker-compose.yml" className="bg-field-background font-mono text-sm" />
                        </TextField>

                        <TextField value={providerTokenDrafts[provider.providerKey] || ''} onChange={(val) => updateProviderTokenDraft(provider.providerKey, val)}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Token ersetzen</Label>
                          <Input placeholder={provider.tokenConfigured ? 'Neuen Token eingeben, um den bestehenden zu ersetzen' : 'Token eingeben'} className="bg-field-background font-mono text-sm" type="password" />
                        </TextField>

                        <TextField value={String(provider.syncIntervalMinutes)} onChange={(val) => updateGitLabProvider(provider.providerKey, { syncIntervalMinutes: Number.parseInt(val || '15', 10) || 15 })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Sync-Intervall (Minuten)</Label>
                          <Input placeholder="15" className="bg-field-background font-mono text-sm" />
                        </TextField>

                        <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                          <div className="flex h-full flex-col justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Token-Status</p>
                              <p className="mt-1 text-xs text-muted">
                                {provider.tokenConfigured ? 'Ein Token ist gespeichert. Beim Ersetzen wird der alte Token überschrieben.' : 'Aktuell ist kein Token gespeichert. Ohne Token ist der Provider nicht für Sync nutzbar.'}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-danger"
                                isDisabled={saving || !provider.tokenConfigured}
                                onPress={() => saveGitLabProvider(provider, { clearToken: true })}
                              >
                                Token löschen
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 rounded-xl border border-border bg-surface-secondary/40 p-4">
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Namespace-Allowlist</Label>
                          <textarea
                            value={provider.namespaceAllowlist.join('\n')}
                            onChange={(event) => updateGitLabProvider(provider.providerKey, {
                              namespaceAllowlist: event.target.value
                                .split(/\n|,/)
                                .map((value) => value.trim())
                                .filter(Boolean),
                            })}
                            className="min-h-[120px] w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
                            placeholder={'gruppe\norganisation/team'}
                          />
                          <p className="mt-2 text-xs text-muted">Leer lassen, um alle Namespaces zuzulassen. Ein Eintrag pro Zeile oder komma-getrennt.</p>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Provider im UI aktiv</p>
                              <p className="text-xs text-muted">Steuert, ob Apps diesen Provider auswählen dürfen.</p>
                            </div>
                            <Switch
                              isSelected={provider.enabled}
                              onChange={(val) => updateGitLabProvider(provider.providerKey, { enabled: val })}
                            >
                              <Switch.Control><Switch.Thumb /></Switch.Control>
                            </Switch>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Automatische Synchronisation</p>
                              <p className="text-xs text-muted">Aktiviert den geplanten Hintergrund-Sync für verknüpfte Apps dieses Providers.</p>
                            </div>
                            <Switch
                              isSelected={provider.autoSyncEnabled}
                              onChange={(val) => updateGitLabProvider(provider.providerKey, { autoSyncEnabled: val })}
                            >
                              <Switch.Control><Switch.Thumb /></Switch.Control>
                            </Switch>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex justify-end border-t border-border pt-4">
                        <Button
                          className="bg-accent text-white"
                          isDisabled={saving}
                          onPress={() => saveGitLabProvider(provider)}
                        >
                          {savedSection === `gitlab-${provider.providerKey}` ? 'Gespeichert ✓' : 'Provider speichern'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}

        {visibleSections.has('ai') && (
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <Bot className="w-4 h-4 text-accent" /> AI-Zugriff
              </h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">AI-Funktion aktivieren</span>
                    <p className="text-xs text-muted max-w-xl">
                      Schaltet den AI-Chat, das Floating-Widget und die zugehörigen API-Endpunkte global ein oder aus.
                    </p>
                  </div>
                  <Switch
                    isSelected={settings.aiEnabled}
                    onChange={(val) => save({ aiEnabled: val }, 'aiEnabled')}
                  >
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Anonymen AI-Zugriff erlauben</span>
                    <p className="text-xs text-muted max-w-xl">
                      Erlaubt nicht angemeldeten Besuchern den Zugriff auf den AI-Chat und das Floating-Widget. Der Verlauf bleibt nur lokal im Browser gespeichert.
                    </p>
                  </div>
                  <Switch
                    isDisabled={!settings.aiEnabled}
                    isSelected={settings.allowAnonymousAI}
                    onChange={(val) => save({ allowAnonymousAI: val }, 'anonymousAI')}
                  >
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>

                {!settings.aiEnabled && (
                  <p className="text-xs text-muted">
                    Die AI-Provider-Konfiguration bleibt erhalten und wird wieder verwendet, sobald die Funktion erneut aktiviert wird.
                  </p>
                )}
              </div>
            </Surface>

            <AIProviderSettingsPanel />
          </div>
        )}
      </div>

      <Modal.Backdrop isOpen={createProviderModalOpen} onOpenChange={(open) => { if (!open) closeCreateProviderModal(); }}>
        <Modal.Container>
          <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-accent">
                <GitBranch className="w-5 h-5" />
              </Modal.Icon>
              <Modal.Heading>Neuen Repository-Provider anlegen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">
                Schlüssel und Typ werden beim Erstellen festgelegt und anschließend nicht mehr geändert. Tokens werden verschlüsselt gespeichert.
              </p>

              {gitLabProviderError && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {gitLabProviderError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TextField value={newProvider.providerKey} onChange={(val) => setNewProvider((prev) => ({ ...prev, providerKey: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Provider-Schlüssel</Label>
                  <Input placeholder="z. B. github-com" className="bg-field-background font-mono text-sm" />
                </TextField>

                <Select
                  selectedKey={newProvider.providerType}
                  onSelectionChange={(key) => {
                    const providerType = String(key) as ProviderDraftState['providerType'];
                    setNewProvider((prev) => ({
                      ...prev,
                      providerType,
                      baseUrl: prev.baseUrl.trim() === '' || prev.baseUrl === defaultBaseUrlForProviderType(prev.providerType)
                        ? defaultBaseUrlForProviderType(providerType)
                        : prev.baseUrl,
                    }));
                  }}
                >
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Provider-Typ</Label>
                  <Select.Trigger className="bg-field-background">
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="gitlab" textValue="GitLab">
                        GitLab
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="github" textValue="GitHub">
                        GitHub
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <TextField value={newProvider.label} onChange={(val) => setNewProvider((prev) => ({ ...prev, label: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Bezeichnung</Label>
                  <Input placeholder="z. B. GitHub.com" className="bg-field-background" />
                </TextField>

                <TextField value={newProvider.baseUrl} onChange={(val) => setNewProvider((prev) => ({ ...prev, baseUrl: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Base URL</Label>
                  <Input placeholder="https://github.com" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={newProvider.token} onChange={(val) => setNewProvider((prev) => ({ ...prev, token: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Token</Label>
                  <Input placeholder="Personal Access Token" className="bg-field-background font-mono text-sm" type="password" />
                </TextField>

                <TextField value={String(newProvider.syncIntervalMinutes)} onChange={(val) => setNewProvider((prev) => ({ ...prev, syncIntervalMinutes: Number.parseInt(val || '15', 10) || 15 }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Sync-Intervall (Minuten)</Label>
                  <Input placeholder="15" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={newProvider.defaultReadmePath} onChange={(val) => setNewProvider((prev) => ({ ...prev, defaultReadmePath: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard README-Pfad</Label>
                  <Input placeholder="optional, z. B. docs/README.md" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={newProvider.defaultHelmValuesPath} onChange={(val) => setNewProvider((prev) => ({ ...prev, defaultHelmValuesPath: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard Helm Values</Label>
                  <Input placeholder="chart/values.yaml" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={newProvider.defaultComposeFilePath} onChange={(val) => setNewProvider((prev) => ({ ...prev, defaultComposeFilePath: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Standard Compose-Datei</Label>
                  <Input placeholder="docker-compose.yml" className="bg-field-background font-mono text-sm" />
                </TextField>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Provider aktiv</p>
                      <p className="text-xs text-muted">Steuert, ob Apps diesen Provider auswählen dürfen.</p>
                    </div>
                    <Switch
                      isSelected={newProvider.enabled}
                      onChange={(val) => setNewProvider((prev) => ({ ...prev, enabled: val }))}
                    >
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Automatische Synchronisation</p>
                      <p className="text-xs text-muted">Aktiviert den geplanten Hintergrund-Sync für verknüpfte Apps dieses Providers.</p>
                    </div>
                    <Switch
                      isSelected={newProvider.autoSyncEnabled}
                      onChange={(val) => setNewProvider((prev) => ({ ...prev, autoSyncEnabled: val }))}
                    >
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-4">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Namespace-Allowlist</Label>
                  <textarea
                    value={newProvider.namespaceAllowlist}
                    onChange={(event) => setNewProvider((prev) => ({ ...prev, namespaceAllowlist: event.target.value }))}
                    className="min-h-[120px] w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    placeholder={'gruppe\norganisation/team'}
                  />
                  <p className="mt-2 text-xs text-muted">Leer lassen, um alle Namespaces zuzulassen. Ein Eintrag pro Zeile oder komma-getrennt.</p>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={closeCreateProviderModal}>
                Abbrechen
              </Button>
              <Button
                className="bg-accent text-white"
                isDisabled={saving || !newProvider.providerKey.trim() || !newProvider.baseUrl.trim() || !newProvider.token.trim()}
                onPress={createGitLabProvider}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Provider anlegen
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <ConfirmDialog
        confirmLabel="Provider löschen"
        description={providerToDelete ? `Der Provider ${providerToDelete.providerKey} wird dauerhaft entfernt. Verknüpfte Apps verhindern das Löschen automatisch.` : ''}
        isDanger
        isLoading={saving}
        isOpen={providerToDelete !== null}
        onConfirm={deleteGitLabProvider}
        onOpenChange={(open) => {
          if (!open) setProviderToDelete(null);
        }}
        title="Repository-Provider löschen"
      />
    </div>
  );
}

export default function EinstellungenPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/verwaltung/plattform');
  }, [router]);

  return (
    <div className="py-20 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );
}
