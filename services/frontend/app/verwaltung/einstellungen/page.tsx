'use client';

import { DetailFieldDef, defaultDetailFields, useSettings } from '@/context/SettingsContext';
import { AVAILABLE_ICONS } from '@/lib/detailFieldIcons';
import { fetchApi, uploadFile } from '@/lib/api';
import {
  Button,
  Input,
  Label,
  Surface,
  Switch,
  TextField,
  Tooltip
} from '@heroui/react';
import { ArrowDown, ArrowUp, Globe, Layers, Loader2, Paintbrush, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

type SettingsState = {
  allowAppSubmissions: boolean;
  showTopBanner: boolean;
  topBannerText: string;
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
  showFlagBar: boolean;
};

const defaultState: SettingsState = {
  allowAppSubmissions: true,
  showTopBanner: false,
  topBannerText: '',
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
  showFlagBar: true,
};

export default function EinstellungenPage() {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'logoDark' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'logoDarkUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = field === 'logoUrl' ? 'logo' : 'logoDark';
    setUploading(key as 'logo' | 'logoDark');
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
    fetchApi('/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setSettings({
          ...defaultState,
          ...data,
          detailFields: (data.detailFields && data.detailFields.length > 0)
            ? data.detailFields
            : defaultDetailFields,
        });
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

  if (loading) return (
    <div className="py-20 flex justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* Submission Control */}
      <Surface className="p-6 border border-border/50 shadow-sm">
        <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" /> Einreichungen
        </h3>
        <div className="flex items-center justify-between">
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

      {/* Top Banner */}
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
              <Input placeholder="Ankündigung hier eingeben..." className="bg-field-background" />
            </TextField>
            <Button
              size="sm"
              className="bg-accent text-white"
              isDisabled={saving}
              onPress={() => save({ topBannerText: settings.topBannerText }, 'banner')}
            >
              {savedSection === 'banner' ? 'Gespeichert ✓' : 'Speichern'}
            </Button>
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

      {/* Branding */}
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
          {/* Logo light */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Logo (Hell-Modus)</Label>
            <div className="flex gap-2 items-center">
              {settings.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoUrl} alt="Logo Preview" className="h-8 w-8 rounded object-contain border border-border bg-surface shrink-0" />
              )}
              <TextField value={settings.logoUrl} onChange={(val) => setSettings({ ...settings, logoUrl: val })} className="flex-1">
                <Input placeholder="https://example.com/logo.png" className="bg-field-background" />
              </TextField>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'logoUrl')} />
              <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" isDisabled={uploading === 'logo'} onPress={() => logoInputRef.current?.click()}>
                {uploading === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading === 'logo' ? 'Lädt...' : 'Upload'}
              </Button>
            </div>
          </div>

          {/* Logo dark */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Logo (Dunkel-Modus)</Label>
            <div className="flex gap-2 items-center">
              {settings.logoDarkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDarkUrl} alt="Logo Dark Preview" className="h-8 w-8 rounded object-contain border border-border bg-[#1a1a1a] shrink-0" />
              )}
              <TextField value={settings.logoDarkUrl} onChange={(val) => setSettings({ ...settings, logoDarkUrl: val })} className="flex-1">
                <Input placeholder="https://example.com/logo-dark.png" className="bg-field-background" />
              </TextField>
              <input ref={logoDarkInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, 'logoDarkUrl')} />
              <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" isDisabled={uploading === 'logoDark'} onPress={() => logoDarkInputRef.current?.click()}>
                {uploading === 'logoDark' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading === 'logoDark' ? 'Lädt...' : 'Upload'}
              </Button>
            </div>
          </div>
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
            <Input placeholder="Der App Store für alle." className="bg-field-background" />
          </TextField>
          <TextField
            value={settings.faviconUrl}
            onChange={(val) => setSettings({ ...settings, faviconUrl: val })}
          >
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Favicon URL</Label>
            <Input placeholder="https://example.com/favicon.ico" className="bg-field-background" />
          </TextField>
          <TextField
            className="md:col-span-2"
            value={settings.heroSubtitle}
            onChange={(val) => setSettings({ ...settings, heroSubtitle: val })}
          >
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Hero Untertitel</Label>
            <Input placeholder="Entdecken Sie Open-Source-Apps, cloud-native Lösungen..." className="bg-field-background" />
          </TextField>
          <TextField
            className="md:col-span-2"
            value={settings.storeDescription}
            onChange={(val) => setSettings({ ...settings, storeDescription: val })}
          >
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Store Beschreibung (SEO / Metadata)</Label>
            <Input placeholder="Zentraler Community Store für Softwarelösungen..." className="bg-field-background" />
          </TextField>
          <TextField
            className="md:col-span-2"
            value={settings.footerText}
            onChange={(val) => setSettings({ ...settings, footerText: val })}
          >
            <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Footer Text</Label>
            <Input placeholder="Die Plattform für moderne, souveräne Software-Lösungen..." className="bg-field-background" />
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
              heroBadge: settings.heroBadge,
              heroTitle: settings.heroTitle,
              heroSubtitle: settings.heroSubtitle,
              footerText: settings.footerText,
              showFlagBar: settings.showFlagBar,
            }, 'branding')}
          >
            {savedSection === 'branding' ? 'Gespeichert ✓' : 'Branding speichern'}
          </Button>
        </div>
      </Surface>

      {/* Fachliche Details Felder */}
      <Surface className="p-6 border border-border/50 shadow-sm">
        <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" /> Fachliche Details — Felder
        </h3>
        <p className="text-xs text-muted mb-5">Definieren Sie, welche Felder im Tab &quot;Fachliche Details&quot; einer App angezeigt und bearbeitet werden können. Reihenfolge, Label und Schlüssel sind frei konfigurierbar.</p>

        <div className="flex flex-col gap-2 mb-4">
          {settings.detailFields.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-surface/50 border border-border rounded-xl p-2.5">
              <div className="flex flex-col gap-1 flex-1 md:flex-row md:gap-3">
                {/* Icon picker */}
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
                    <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-0.5">Schlüssel (intern)</Label>
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
            <Plus className="w-3.5 h-3.5" /> Feld hinzufügen
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

    </div>
  );
}
