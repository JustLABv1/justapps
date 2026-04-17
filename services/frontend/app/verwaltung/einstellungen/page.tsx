'use client';

import { GitLabProviderAdminSettings } from '@/config/apps';
import { DetailFieldDef, FooterLink, defaultDetailFields, useSettings } from '@/context/SettingsContext';
import { fetchApi, uploadFile } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/assets';
import { AVAILABLE_ICONS } from '@/lib/detailFieldIcons';
import {
    Button,
    Input,
    Label,
    ListBox,
    Select,
    Surface,
    Switch,
    Tabs,
    TextField,
    Tooltip
} from '@heroui/react';
import { ArrowDown, ArrowUp, ExternalLink, GitBranch, Globe, Layers, Loader2, Paintbrush, Pin, Plus, ShieldCheck, SortAsc, SortDesc, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type SettingsState = {
  allowAppSubmissions: boolean;
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
  heroSubtitle: string;
  footerText: string;
  footerLinks: FooterLink[];
  showFlagBar: boolean;
  appSortField: string;
  appSortDirection: string;
  pinnedApps: string[];
  enableLinkProbing: boolean;
};

const defaultState: SettingsState = {
  allowAppSubmissions: true,
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
  heroSubtitle: '',
  footerText: '',
  footerLinks: [],
  showFlagBar: true,
  appSortField: 'name',
  appSortDirection: 'asc',
  pinnedApps: [],
  enableLinkProbing: true,
};

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
    appSortField: data.appSortField || 'name',
    appSortDirection: data.appSortDirection || 'asc',
    pinnedApps: Array.isArray(data.pinnedApps)
      ? data.pinnedApps
      : [],
  };
}

export default function EinstellungenPage() {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [gitLabProviders, setGitLabProviders] = useState<GitLabProviderAdminSettings[]>([]);
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

  useEffect(() => {
    Promise.all([
      fetchApi('/settings').then(res => res.ok ? res.json() : null),
      fetchApi('/settings/gitlab/providers').then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error((error as { message?: string }).message || 'GitLab-Provider konnten nicht geladen werden.');
        }
        return res.json() as Promise<GitLabProviderAdminSettings[]>;
      }),
    ])
      .then(([settingsData, providersData]) => {
        if (settingsData) setSettings(normalizeSettingsState(settingsData));
        setGitLabProviders(Array.isArray(providersData) ? providersData : []);
        setGitLabProviderError(null);
      })
      .catch((error) => {
        setGitLabProviderError(error instanceof Error ? error.message : 'GitLab-Provider konnten nicht geladen werden.');
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

  const saveGitLabProvider = async (provider: GitLabProviderAdminSettings) => {
    setSaving(true);
    setGitLabProviderError(null);
    try {
      const res = await fetchApi(`/settings/gitlab/providers/${provider.providerKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: provider.label,
          baseUrl: provider.baseUrl,
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
        throw new Error((data as { message?: string }).message || 'GitLab-Provider konnte nicht gespeichert werden.');
      }

      const updatedProvider = data as GitLabProviderAdminSettings;
      setGitLabProviders((prev) => prev.map((item) => (
        item.providerKey === updatedProvider.providerKey ? updatedProvider : item
      )));
      setSavedSection(`gitlab-${provider.providerKey}`);
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(error instanceof Error ? error.message : 'GitLab-Provider konnte nicht gespeichert werden.');
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Plattform-Einstellungen</h1>
        <p className="text-sm text-muted max-w-3xl">
          Die Konfiguration ist in Themenbereiche aufgeteilt, damit Startseite, Branding, Inhalte und App-Verhalten schneller gepflegt werden koennen.
        </p>
      </div>

      <Tabs variant="secondary" className="w-full" defaultSelectedKey="startseite">
        <Tabs.ListContainer className="rounded-2xl border border-border/50 bg-surface p-2 shadow-sm overflow-x-auto">
          <Tabs.List aria-label="Einstellungsbereiche" className="w-max min-w-full justify-start gap-2">
            <Tabs.Tab id="governance" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Governance
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="startseite" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> Startseite
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="branding" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4" /> Branding
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="inhalte" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" /> Inhalte
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="apps" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4" /> Apps
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="integrationen" className="rounded-xl px-4 py-3 text-sm font-semibold text-muted data-[selected=true]:text-foreground">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Integrationen
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="governance" className="pt-6">
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
            </Surface>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="startseite" className="pt-6">
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
                    <span className="text-sm font-semibold">Deutschlandfahne anzeigen</span>
                    <p className="text-xs text-muted">Zeigt den schwarzrot-goldenen Balken am oberen Seitenrand.</p>
                  </div>
                  <Switch
                    isSelected={settings.showFlagBar}
                    onChange={(val) => setSettings({ ...settings, showFlagBar: val })}
                  >
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <Button
                  className="bg-accent text-white"
                  isDisabled={saving}
                  onPress={() => save({
                    heroBadge: settings.heroBadge,
                    heroTitle: settings.heroTitle,
                    heroSubtitle: settings.heroSubtitle,
                    footerText: settings.footerText,
                    showFlagBar: settings.showFlagBar,
                  }, 'homepage')}
                >
                  {savedSection === 'homepage' ? 'Gespeichert ✓' : 'Startseite speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="branding" className="pt-6">
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-accent" /> Branding & Erscheinungsbild
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
                  {savedSection === 'branding' ? 'Gespeichert ✓' : 'Branding speichern'}
                </Button>
              </div>
            </Surface>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="inhalte" className="pt-6">
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
        </Tabs.Panel>

        <Tabs.Panel id="apps" className="pt-6">
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
        </Tabs.Panel>

        <Tabs.Panel id="integrationen" className="pt-6">
          <div className="flex flex-col gap-6">
            <Surface className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent" /> GitLab-Provider
              </h3>
              <p className="text-xs text-muted mb-5">
                Verwalten Sie hier die nicht-geheimen GitLab-Einstellungen. Tokens verbleiben ausschließlich in der Backend-Konfiguration oder in Umgebungsvariablen.
              </p>

              {gitLabProviderError && (
                <div className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {gitLabProviderError}
                </div>
              )}

              {gitLabProviders.length === 0 ? (
                <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning">
                  Es sind aktuell keine GitLab-Provider im Backend konfiguriert.
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {gitLabProviders.map((provider) => (
                    <div key={provider.providerKey} className="rounded-2xl border border-border bg-surface p-5">
                      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{provider.providerKey}</p>
                          <p className="mt-1 text-xs text-muted">
                            {provider.tokenConfigured ? 'Token im Backend vorhanden' : 'Kein Token im Backend konfiguriert'}
                            {provider.configured ? ' · Provider aktiv konfiguriert' : ' · Provider im Backend derzeit nicht aktiv'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${provider.enabled ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-surface-secondary text-muted'}`}>
                            {provider.enabled ? 'Aktiv' : 'Deaktiviert'}
                          </span>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${provider.autoSyncEnabled ? 'border-accent/20 bg-accent/10 text-accent' : 'border-border bg-surface-secondary text-muted'}`}>
                            {provider.autoSyncEnabled ? 'Auto-Sync an' : 'Auto-Sync aus'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <TextField value={provider.label} onChange={(val) => updateGitLabProvider(provider.providerKey, { label: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Bezeichnung</Label>
                          <Input placeholder="GitLab Bund" className="bg-field-background" />
                        </TextField>

                        <TextField value={provider.baseUrl} onChange={(val) => updateGitLabProvider(provider.providerKey, { baseUrl: val })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Base URL</Label>
                          <Input placeholder="https://gitlab.example.org" className="bg-field-background font-mono text-sm" />
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

                        <TextField value={String(provider.syncIntervalMinutes)} onChange={(val) => updateGitLabProvider(provider.providerKey, { syncIntervalMinutes: Number.parseInt(val || '15', 10) || 15 })}>
                          <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Sync-Intervall (Minuten)</Label>
                          <Input placeholder="15" className="bg-field-background font-mono text-sm" />
                        </TextField>

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
                          isDisabled={saving || !provider.tokenConfigured}
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
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
