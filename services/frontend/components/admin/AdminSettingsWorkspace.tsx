"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AIProviderSettingsPanel } from "@/components/admin/AIProviderSettingsPanel";
import { SpaceCreationPolicyPanel } from "@/components/SpaceCreationPolicyPanel";
import { GitLabProviderAdminSettings } from "@/config/apps";
import {
  DetailFieldDef,
  FooterLink,
  defaultDetailFields,
  useSettings,
} from "@/context/SettingsContext";
import { fetchApi, uploadFile } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
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
} from "@/lib/branding";
import { toast } from "@/lib/toast";
import { AVAILABLE_ICONS } from "@/lib/detailFieldIcons";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Switch } from "@/components/panelui/switch";
import { Textarea } from "@/components/panelui/textarea";
import { Tooltip } from "@/components/panelui/tooltip";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ExternalLink,
  Globe,
  Layers,
  Paintbrush,
  Pin,
  Plus,
  ShieldCheck,
  SortAsc,
  SortDesc,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AdminSettingsSection =
  | "governance"
  | "access"
  | "ai-access"
  | "footer"
  | "startseite"
  | "branding"
  | "inhalte"
  | "apps"
  | "integrationen"
  | "ai";

type AdminSettingsWorkspaceProps = {
  title: string;
  description: string;
  sections: AdminSettingsSection[];
  showHeading?: boolean;
};

type SettingsState = {
  aiEnabled: boolean;
  faqEnabled: boolean;
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
  faqEnabled: true,
  allowAppSubmissions: true,
  requireAuthForAppStore: false,
  allowAnonymousAI: false,
  showTopBanner: false,
  topBannerText: "",
  topBannerType: "info",
  detailFields: defaultDetailFields,
  storeName: "",
  storeDescription: "",
  logoUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
  accentColor: "",
  heroBadge: "",
  heroTitle: "",
  heroTitlePreset: DEFAULT_HERO_TITLE_PRESET,
  heroTitleColors: [],
  heroSubtitle: "",
  footerText: "",
  footerLinks: [],
  showFlagBar: true,
  topBarPreset: DEFAULT_TOP_BAR_PRESET,
  topBarColors: [],
  appSortField: "name",
  appSortDirection: "asc",
  pinnedApps: [],
  enableLinkProbing: true,
};

type ProviderDraftState = {
  providerKey: string;
  providerType: "gitlab" | "github";
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
  providerKey: "",
  providerType: "gitlab",
  label: "",
  baseUrl: "https://gitlab.com",
  token: "",
  namespaceAllowlist: "",
  enabled: true,
  autoSyncEnabled: true,
  syncIntervalMinutes: 15,
  defaultReadmePath: "",
  defaultHelmValuesPath: "",
  defaultComposeFilePath: "",
});

const allowedAppSortFields = new Set([
  "name",
  "rating_avg",
  "updated_at",
  "status",
]);

function normalizeAppSortField(value: string | undefined) {
  return value && allowedAppSortFields.has(value) ? value : "name";
}

function defaultBaseUrlForProviderType(
  providerType: "gitlab" | "github",
): string {
  return providerType === "github"
    ? "https://github.com"
    : "https://gitlab.com";
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
    detailFields:
      Array.isArray(data.detailFields) && data.detailFields.length > 0
        ? data.detailFields
        : defaultDetailFields,
    footerLinks: Array.isArray(data.footerLinks) ? data.footerLinks : [],
    heroTitlePreset: data.heroTitlePreset || DEFAULT_HERO_TITLE_PRESET,
    heroTitleColors: normalizeBrandColorList(data.heroTitleColors),
    topBarPreset: data.topBarPreset || DEFAULT_TOP_BAR_PRESET,
    topBarColors: normalizeBrandColorList(data.topBarColors),
    appSortField: normalizeAppSortField(data.appSortField),
    appSortDirection: data.appSortDirection || "asc",
    pinnedApps: Array.isArray(data.pinnedApps) ? data.pinnedApps : [],
  };
}

const BANNER_TYPES = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warnung" },
  { value: "critical", label: "Kritisch" },
];

const SORT_FIELDS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "rating_avg", label: "Bewertung" },
  { value: "updated_at", label: "Zuletzt aktualisiert" },
  { value: "status", label: "Status" },
];

const PROVIDER_TYPES = [
  { value: "gitlab", label: "GitLab" },
  { value: "github", label: "GitHub" },
];

function PalettePreview({ colors }: { colors: string[] }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10">
      {colors.map((color, index) => (
        <div key={`${color}-${index}`} className="h-full flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

/** One group of related settings: a titled card with its own save bar. */
function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </Card.Title>
        {description && <Card.Description>{description}</Card.Description>}
      </Card.Header>
      <Card.Content>{children}</Card.Content>
    </Card>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  pending,
  disabled,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <Switch label={title} checked={checked} disabled={disabled} pending={pending} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({
  saving,
  saved,
  label,
  onSave,
  start,
}: {
  saving: boolean;
  saved: boolean;
  label: string;
  onSave: () => void;
  start?: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <div>{start}</div>
      <Button loading={saving} onClick={onSave}>
        {saved ? "Gespeichert ✓" : label}
      </Button>
    </div>
  );
}

function PresetSelect({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: string; label: string; description: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const items = options.map((option) => ({ value: option.id, label: option.label }));
  return (
    <Select items={items} value={value} onValueChange={(next) => onChange(String(next))}>
      <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
      <Select.Content>
        {options.map((option) => (
          <Select.Item key={option.id} value={option.id}>
            <span className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </span>
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
}

function ColorField({ label, color, value, onChange }: { label: string; color: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-end gap-2">
      <span className="mb-0.5 size-9 shrink-0 rounded-lg ring-1 ring-foreground/15" style={{ backgroundColor: color || "transparent" }} />
      <Field className="flex-1">
        <Field.Label>{label}</Field.Label>
        <Input className="font-mono text-sm" value={value} placeholder="#004B76" onChange={(event) => onChange(event.target.value)} />
      </Field>
    </div>
  );
}

/** A URL field with a preview and an upload button. */
function AssetField({
  label,
  previewUrl,
  previewClassName,
  value,
  placeholder,
  uploading,
  inputRef,
  onChange,
  onFile,
}: {
  label: string;
  previewUrl: string | null | undefined;
  previewClassName: string;
  value: string;
  placeholder: string;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <div className="flex items-center gap-2">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className={`size-9 shrink-0 rounded-lg object-contain ring-1 ring-foreground/15 ${previewClassName}`} />
        )}
        <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button type="button" variant="secondary" className="shrink-0" loading={uploading} onClick={() => inputRef.current?.click()}>
          <Upload />
          Upload
        </Button>
      </div>
    </Field>
  );
}

type RepositoryProviderValues = {
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

/** The fields of a repository provider, shared by the editor of an existing one and the dialog that creates one. */
function RepositoryProviderFields({
  values,
  onChange,
  tokenLabel,
  tokenPlaceholder,
  tokenStatus,
}: {
  values: RepositoryProviderValues;
  onChange: (patch: Partial<RepositoryProviderValues>) => void;
  tokenLabel: string;
  tokenPlaceholder: string;
  tokenStatus?: React.ReactNode;
}) {
  const mono = "font-mono text-sm";
  return (
    <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
      <Field>
        <Field.Label>Bezeichnung</Field.Label>
        <Input value={values.label} placeholder="z. B. interne Forge oder GitHub.com" onChange={(event) => onChange({ label: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Base URL</Field.Label>
        <Input className={mono} value={values.baseUrl} placeholder="https://gitlab.example.org oder https://github.com" onChange={(event) => onChange({ baseUrl: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>{tokenLabel}</Field.Label>
        <Input className={mono} type="password" autoComplete="new-password" value={values.token} placeholder={tokenPlaceholder} onChange={(event) => onChange({ token: event.target.value })} />
        {tokenStatus}
      </Field>
      <Field>
        <Field.Label>Sync-Intervall (Minuten)</Field.Label>
        <Input className={mono} inputMode="numeric" value={String(values.syncIntervalMinutes)} placeholder="15" onChange={(event) => onChange({ syncIntervalMinutes: Number.parseInt(event.target.value || "15", 10) || 15 })} />
      </Field>
      <Field>
        <Field.Label>Standard README-Pfad</Field.Label>
        <Input className={mono} value={values.defaultReadmePath} placeholder="optional, z. B. docs/README.md" onChange={(event) => onChange({ defaultReadmePath: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Standard Helm Values</Field.Label>
        <Input className={mono} value={values.defaultHelmValuesPath} placeholder="chart/values.yaml" onChange={(event) => onChange({ defaultHelmValuesPath: event.target.value })} />
      </Field>
      <Field className="@lg:col-span-2">
        <Field.Label>Standard Compose-Datei</Field.Label>
        <Input className={mono} value={values.defaultComposeFilePath} placeholder="docker-compose.yml" onChange={(event) => onChange({ defaultComposeFilePath: event.target.value })} />
      </Field>
      <Field className="@lg:col-span-2">
        <Field.Label>Namespace-Allowlist</Field.Label>
        <Textarea className={mono} rows={4} value={values.namespaceAllowlist} placeholder={"gruppe\norganisation/team"} onChange={(event) => onChange({ namespaceAllowlist: event.target.value })} />
        <Field.Description>Leer lassen, um alle Namespaces zuzulassen. Ein Eintrag pro Zeile oder komma-getrennt.</Field.Description>
      </Field>
      <ToggleRow title="Provider im UI aktiv" description="Steuert, ob Apps diesen Provider auswählen dürfen." checked={values.enabled} onChange={(enabled) => onChange({ enabled })} />
      <ToggleRow title="Automatische Synchronisation" description="Aktiviert den geplanten Hintergrund-Sync für verknüpfte Apps dieses Providers." checked={values.autoSyncEnabled} onChange={(autoSyncEnabled) => onChange({ autoSyncEnabled })} />
    </div>
  );
}

export function AdminSettingsWorkspace({
  title,
  description,
  sections,
  showHeading = true,
}: AdminSettingsWorkspaceProps) {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState<SettingsState>(defaultState);
  const [gitLabProviders, setGitLabProviders] = useState<
    GitLabProviderAdminSettings[]
  >([]);
  const [createProviderModalOpen, setCreateProviderModalOpen] = useState(false);
  const [newProvider, setNewProvider] =
    useState<ProviderDraftState>(defaultProviderDraft);
  const [providerTokenDrafts, setProviderTokenDrafts] = useState<
    Record<string, string>
  >({});
  const [
    providerNamespaceAllowlistDrafts,
    setProviderNamespaceAllowlistDrafts,
  ] = useState<Record<string, string>>({});
  const [providerToDelete, setProviderToDelete] =
    useState<GitLabProviderAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [uploading, setUploading] = useState<
    "logo" | "logoDark" | "favicon" | null
  >(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [gitLabProviderError, setGitLabProviderError] = useState<string | null>(
    null,
  );
  const [pinnedAppInput, setPinnedAppInput] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoPreviewUrl = resolveAssetUrl(settings.logoUrl);
  const logoDarkPreviewUrl = resolveAssetUrl(settings.logoDarkUrl);
  const faviconPreviewUrl = resolveAssetUrl(settings.faviconUrl);
  const topBarPreviewColors = resolveTopBarColors(
    settings.topBarPreset,
    settings.topBarColors,
  );
  const heroTitlePreviewColors = resolveHeroTitleColors(
    settings.heroTitlePreset,
    settings.heroTitleColors,
  );
  const visibleSections = new Set(sections);
  const loadRepositorySettings = sections.includes("integrationen");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

  const updateBrandColors = (
    field: "topBarColors" | "heroTitleColors",
    index: number,
    value: string,
  ) => {
    const nextColors = seedCustomBrandColors(
      settings[field],
      field === "topBarColors" ? topBarPreviewColors : heroTitlePreviewColors,
    );
    nextColors[index] = value.trim();
    setSettings({ ...settings, [field]: nextColors });
  };

  const handleTopBarPresetChange = (key: string) => {
    setSettings({
      ...settings,
      topBarPreset: key,
      topBarColors:
        key === CUSTOM_BRANDING_PRESET
          ? seedCustomBrandColors(settings.topBarColors, topBarPreviewColors)
          : settings.topBarColors,
    });
  };

  const handleHeroTitlePresetChange = (key: string) => {
    setSettings({
      ...settings,
      heroTitlePreset: key,
      heroTitleColors:
        key === CUSTOM_BRANDING_PRESET
          ? seedCustomBrandColors(
              settings.heroTitleColors,
              heroTitlePreviewColors,
            )
          : settings.heroTitleColors,
    });
  };

  const handleLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "logoDarkUrl" | "faviconUrl",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key =
      field === "logoUrl"
        ? "logo"
        : field === "logoDarkUrl"
          ? "logoDark"
          : "favicon";
    setUploading(key as "logo" | "logoDark" | "favicon");
    setUploadError(null);
    try {
      const url = await uploadFile("/upload/logo", file);
      setSettings((prev) => ({ ...prev, [field]: url }));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen",
      );
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const fetchRepositoryProviders = async (): Promise<
    GitLabProviderAdminSettings[]
  > => {
    const res = await fetchApi("/settings/repository-providers");
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(
        (error as { message?: string }).message ||
          "Repository-Provider konnten nicht geladen werden.",
      );
    }

    const providersData = (await res.json()) as GitLabProviderAdminSettings[];
    return Array.isArray(providersData) ? providersData : [];
  };

  const loadRepositoryProviders = async () => {
    const providersData = await fetchRepositoryProviders();
    setGitLabProviders(Array.isArray(providersData) ? providersData : []);
    setProviderNamespaceAllowlistDrafts(
      Object.fromEntries(
        providersData.map((provider) => [
          provider.providerKey,
          provider.namespaceAllowlist.join("\n"),
        ]),
      ),
    );
    setGitLabProviderError(null);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchApi("/settings").then((res) => {
        if (!res.ok)
          throw new Error("Einstellungen konnten nicht geladen werden.");
        return res.json();
      }),
      loadRepositorySettings ? fetchRepositoryProviders() : Promise.resolve([]),
    ])
      .then(([settingsData, providersData]) => {
        if (!active) return;
        if (settingsData) setSettings(normalizeSettingsState(settingsData));
        setGitLabProviders(providersData);
        setProviderNamespaceAllowlistDrafts(
          Object.fromEntries(
            providersData.map((provider) => [
              provider.providerKey,
              provider.namespaceAllowlist.join("\n"),
            ]),
          ),
        );
        setGitLabProviderError(null);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Einstellungen konnten nicht geladen werden.",
        );
        setGitLabProviderError(
          error instanceof Error
            ? error.message
            : "Repository-Provider konnten nicht geladen werden.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRepositorySettings, loadVersion]);

  const save = async (patch: Partial<SettingsState>, sectionKey: string) => {
    const updated = { ...settings, ...patch };
    setSaving(true);
    try {
      const res = await fetchApi("/settings", {
        method: "PUT",
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setSettings(updated);
        await refreshSettings();
        setSavedSection(sectionKey);
        setTimeout(() => setSavedSection(null), 2000);
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.danger(body.message || "Die Einstellungen konnten nicht gespeichert werden.");
      }
    } catch (err) {
      console.error(err);
      toast.danger("Die Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const updateGitLabProvider = (
    providerKey: string,
    patch: Partial<GitLabProviderAdminSettings>,
  ) => {
    setGitLabProviders((prev) =>
      prev.map((provider) =>
        provider.providerKey === providerKey
          ? { ...provider, ...patch }
          : provider,
      ),
    );
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
      const res = await fetchApi("/settings/repository-providers", {
        method: "POST",
        body: JSON.stringify({
          providerKey: newProvider.providerKey.trim(),
          providerType: newProvider.providerType,
          label: newProvider.label,
          baseUrl: newProvider.baseUrl.trim(),
          token: newProvider.token,
          namespaceAllowlist: parseProviderAllowlist(
            newProvider.namespaceAllowlist,
          ),
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
        throw new Error(
          (data as { message?: string }).message ||
            "Repository-Provider konnte nicht erstellt werden.",
        );
      }

      await loadRepositoryProviders();
      closeCreateProviderModal();
      setSavedSection("gitlab-create");
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(
        error instanceof Error
          ? error.message
          : "Repository-Provider konnte nicht erstellt werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveGitLabProvider = async (
    provider: GitLabProviderAdminSettings,
    options?: { clearToken?: boolean },
  ) => {
    setSaving(true);
    setGitLabProviderError(null);
    try {
      const tokenDraft =
        providerTokenDrafts[provider.providerKey]?.trim() || "";
      const namespaceAllowlist = parseProviderAllowlist(
        providerNamespaceAllowlistDrafts[provider.providerKey] ??
          provider.namespaceAllowlist.join("\n"),
      );
      const res = await fetchApi(
        `/settings/repository-providers/${provider.providerKey}`,
        {
          method: "PUT",
          body: JSON.stringify({
            label: provider.label,
            baseUrl: provider.baseUrl,
            token: options?.clearToken ? "" : tokenDraft,
            clearToken: options?.clearToken ?? false,
            namespaceAllowlist,
            enabled: provider.enabled,
            autoSyncEnabled: provider.autoSyncEnabled,
            syncIntervalMinutes: provider.syncIntervalMinutes,
            defaultReadmePath: provider.defaultReadmePath,
            defaultHelmValuesPath: provider.defaultHelmValuesPath,
            defaultComposeFilePath: provider.defaultComposeFilePath,
          }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message ||
            "Repository-Provider konnte nicht gespeichert werden.",
        );
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
      setGitLabProviderError(
        error instanceof Error
          ? error.message
          : "Repository-Provider konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteGitLabProvider = async () => {
    if (!providerToDelete) return;

    setSaving(true);
    setGitLabProviderError(null);
    try {
      const res = await fetchApi(
        `/settings/repository-providers/${providerToDelete.providerKey}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message ||
            "Repository-Provider konnte nicht gelöscht werden.",
        );
      }

      await loadRepositoryProviders();
      setProviderToDelete(null);
      setSavedSection("gitlab-delete");
      setTimeout(() => setSavedSection(null), 2000);
    } catch (error) {
      setGitLabProviderError(
        error instanceof Error
          ? error.message
          : "Repository-Provider konnte nicht gelöscht werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <p role="status" className="py-16 text-center text-sm text-muted-foreground">
        Einstellungen werden geladen …
      </p>
    );

  if (loadError)
    return (
      <Alert variant="plain" tone="destructive">
        <Alert.Icon />
        <Alert.Title>{loadError}</Alert.Title>
        <Alert.Actions>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              setLoadVersion((current) => current + 1);
            }}
          >
            Erneut laden
          </Button>
        </Alert.Actions>
      </Alert>
    );

  return (
    <div className="flex w-full flex-col gap-6">
      {showHeading && (
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-3xl text-pretty text-muted-foreground">{description}</p>
        </header>
      )}

      <div className="flex flex-col gap-6">
        {visibleSections.has("access") && (
          <SettingsCard icon={<ShieldCheck />} title="Zugriffsschutz">
            <ToggleRow
              title="App Store nur für angemeldete Nutzer"
              description="Blockiert den öffentlichen Zugriff auf Katalog, App-Details und Gruppen und leitet Besucher direkt zur Anmeldung weiter."
              checked={settings.requireAuthForAppStore}
              pending={saving}
              onChange={(value) => void save({ requireAuthForAppStore: value }, "requireAuthForAppStore")}
            />
          </SettingsCard>
        )}

        {visibleSections.has("governance") && (
          <>
            <SettingsCard icon={<ShieldCheck />} title="Einreichungen">
              <ToggleRow
                title="App-Einreichungen erlauben"
                description="Geben Sie Benutzern die Freiheit, eigene Apps vorzuschlagen."
                checked={settings.allowAppSubmissions}
                pending={saving}
                onChange={(value) => void save({ allowAppSubmissions: value }, "submissions")}
              />
            </SettingsCard>

            <SpaceCreationPolicyPanel />

            <SettingsCard icon={<Layers />} title="FAQ & Community">
              <ToggleRow
                title="FAQ aktivieren"
                description="Erlaubt Benutzern, Fragen zu Apps zu stellen, Antworten zu geben und hilfreiche Antworten hochzuwerten. Wenn deaktiviert, wird die FAQ-Registerkarte ausgeblendet; bestehende Fragen und Antworten bleiben erhalten."
                checked={settings.faqEnabled}
                pending={saving}
                onChange={(value) => void save({ faqEnabled: value }, "faqEnabled")}
              />
            </SettingsCard>
          </>
        )}

        {visibleSections.has("startseite") && (
          <>
            <SettingsCard icon={<Globe />} title="Top Banner" description="Eine Ankündigung über der gesamten Seite.">
              <div className="flex flex-col gap-4">
                <ToggleRow
                  title="Banner anzeigen"
                  checked={settings.showTopBanner}
                  pending={saving}
                  onChange={(value) => void save({ showTopBanner: value }, "bannerToggle")}
                />
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <Field>
                    <Field.Label>Banner-Text</Field.Label>
                    <Input value={settings.topBannerText} placeholder="Ankündigung hier eingeben …" onChange={(event) => setSettings({ ...settings, topBannerText: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>Typ</Field.Label>
                    <Select items={BANNER_TYPES} value={settings.topBannerType || "info"} onValueChange={(value) => setSettings({ ...settings, topBannerType: String(value) })}>
                      <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                      <Select.Content>{BANNER_TYPES.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                    </Select>
                  </Field>
                </div>
              </div>
              <SaveBar
                saving={saving}
                saved={savedSection === "banner"}
                label="Speichern"
                onSave={() => void save({ topBannerText: settings.topBannerText, topBannerType: settings.topBannerType }, "banner")}
              />
            </SettingsCard>

            <SettingsCard icon={<Globe />} title="Hero & Footer">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <Field.Label>Hero-Badge</Field.Label>
                  <Input value={settings.heroBadge} placeholder="Open Source. Community-getrieben." onChange={(event) => setSettings({ ...settings, heroBadge: event.target.value })} />
                </Field>
                <Field>
                  <Field.Label>Hero-Titel</Field.Label>
                  <Input value={settings.heroTitle} placeholder="Der App Store für alle." onChange={(event) => setSettings({ ...settings, heroTitle: event.target.value })} />
                </Field>
                <Field className="md:col-span-2">
                  <Field.Label>Hero-Untertitel</Field.Label>
                  <Input value={settings.heroSubtitle} placeholder="Entdecken Sie Open-Source-Apps, cloud-native Lösungen …" onChange={(event) => setSettings({ ...settings, heroSubtitle: event.target.value })} />
                </Field>
                <Field className="md:col-span-2">
                  <Field.Label>Footer-Text</Field.Label>
                  <Input value={settings.footerText} placeholder="Die Plattform für moderne, souveräne Software-Lösungen …" onChange={(event) => setSettings({ ...settings, footerText: event.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <ToggleRow
                    title="Farbbalken oben anzeigen"
                    description="Zeigt einen schmalen Farbbalken am oberen Seitenrand."
                    checked={settings.showFlagBar}
                    onChange={(value) => setSettings({ ...settings, showFlagBar: value })}
                  />
                </div>

                <div className="@container flex flex-col gap-4 rounded-xl bg-muted/40 p-4 md:col-span-2">
                  <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_14rem] @lg:items-end">
                    <Field>
                      <Field.Label>Preset für den oberen Balken</Field.Label>
                      <PresetSelect options={TOP_BAR_PRESET_OPTIONS} value={settings.topBarPreset} onChange={handleTopBarPresetChange} />
                    </Field>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Vorschau</span>
                      <PalettePreview colors={topBarPreviewColors} />
                    </div>
                  </div>
                  {settings.topBarPreset === CUSTOM_BRANDING_PRESET && (
                    <div className="grid gap-3 @lg:grid-cols-3">
                      {topBarPreviewColors.map((color, index) => (
                        <ColorField key={`top-bar-color-${index}`} label={`Balkenfarbe ${index + 1}`} color={color} value={settings.topBarColors[index] || ""} onChange={(value) => updateBrandColors("topBarColors", index, value)} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="@container flex flex-col gap-4 rounded-xl bg-muted/40 p-4 md:col-span-2">
                  <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_14rem] @lg:items-end">
                    <Field>
                      <Field.Label>Preset für die Hero-Titel-Farben</Field.Label>
                      <PresetSelect options={HERO_TITLE_PRESET_OPTIONS} value={settings.heroTitlePreset} onChange={handleHeroTitlePresetChange} />
                    </Field>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Vorschau</span>
                      <div className="rounded-lg bg-card px-4 py-2.5 ring-1 ring-foreground/10">
                        <p
                          className="truncate bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
                          style={{ backgroundImage: `linear-gradient(90deg, ${heroTitlePreviewColors.join(", ")})` }}
                        >
                          {settings.heroTitle || "Der App Store für alle."}
                        </p>
                      </div>
                    </div>
                  </div>
                  {settings.heroTitlePreset === CUSTOM_BRANDING_PRESET && (
                    <div className="grid gap-3 @lg:grid-cols-3">
                      {heroTitlePreviewColors.map((color, index) => (
                        <ColorField key={`hero-title-color-${index}`} label={`Titelfarbe ${index + 1}`} color={color} value={settings.heroTitleColors[index] || ""} onChange={(value) => updateBrandColors("heroTitleColors", index, value)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <SaveBar
                saving={saving}
                saved={savedSection === "homepage"}
                label="Startseite speichern"
                onSave={() =>
                  void save(
                    {
                      heroBadge: settings.heroBadge,
                      heroTitle: settings.heroTitle,
                      heroTitlePreset: settings.heroTitlePreset,
                      heroTitleColors: settings.heroTitleColors,
                      heroSubtitle: settings.heroSubtitle,
                      footerText: settings.footerText,
                      showFlagBar: settings.showFlagBar,
                      topBarPreset: settings.topBarPreset,
                      topBarColors: settings.topBarColors,
                    },
                    "homepage",
                  )
                }
              />
            </SettingsCard>
          </>
        )}

        {visibleSections.has("branding") && (
          <SettingsCard icon={<Paintbrush />} title="Erscheinungsbild">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <Field.Label>Store-Name</Field.Label>
                <Input value={settings.storeName} placeholder="JustApps" onChange={(event) => setSettings({ ...settings, storeName: event.target.value })} />
              </Field>
              <Field>
                <Field.Label>Akzentfarbe (CSS-Wert)</Field.Label>
                <Input value={settings.accentColor} placeholder="#004B76 oder oklch(0.42 0.12 245)" onChange={(event) => setSettings({ ...settings, accentColor: event.target.value })} />
              </Field>
              <AssetField
                label="Logo (Hell-Modus)"
                previewUrl={logoPreviewUrl}
                previewClassName="bg-card"
                value={settings.logoUrl}
                placeholder="https://example.com/logo.png"
                uploading={uploading === "logo"}
                inputRef={logoInputRef}
                onChange={(value) => setSettings({ ...settings, logoUrl: value })}
                onFile={(event) => void handleLogoUpload(event, "logoUrl")}
              />
              <AssetField
                label="Logo (Dunkel-Modus)"
                previewUrl={logoDarkPreviewUrl}
                previewClassName="bg-[#1a1a1a]"
                value={settings.logoDarkUrl}
                placeholder="https://example.com/logo-dark.png"
                uploading={uploading === "logoDark"}
                inputRef={logoDarkInputRef}
                onChange={(value) => setSettings({ ...settings, logoDarkUrl: value })}
                onFile={(event) => void handleLogoUpload(event, "logoDarkUrl")}
              />
              <div className="md:col-span-2">
                <AssetField
                  label="Favicon"
                  previewUrl={faviconPreviewUrl}
                  previewClassName="bg-card"
                  value={settings.faviconUrl}
                  placeholder="https://example.com/favicon.ico"
                  uploading={uploading === "favicon"}
                  inputRef={faviconInputRef}
                  onChange={(value) => setSettings({ ...settings, faviconUrl: value })}
                  onFile={(event) => void handleLogoUpload(event, "faviconUrl")}
                />
              </div>
              <Field className="md:col-span-2">
                <Field.Label>Store-Beschreibung (SEO / Metadaten)</Field.Label>
                <Input value={settings.storeDescription} placeholder="Zentraler App Store für Softwarelösungen …" onChange={(event) => setSettings({ ...settings, storeDescription: event.target.value })} />
              </Field>
            </div>
            {uploadError && (
              <Alert variant="plain" tone="destructive" className="mt-4">
                <Alert.Icon />
                <Alert.Title>{uploadError}</Alert.Title>
              </Alert>
            )}
            <SaveBar
              saving={saving || uploading !== null}
              saved={savedSection === "branding"}
              label="Erscheinungsbild speichern"
              onSave={() =>
                void save(
                  {
                    storeName: settings.storeName,
                    storeDescription: settings.storeDescription,
                    logoUrl: settings.logoUrl,
                    logoDarkUrl: settings.logoDarkUrl,
                    faviconUrl: settings.faviconUrl,
                    accentColor: settings.accentColor,
                  },
                  "branding",
                )
              }
            />
          </SettingsCard>
        )}

        {visibleSections.has("inhalte") && (
          <SettingsCard
            icon={<Layers />}
            title="Fachliche Details – Felder"
            description="Definieren Sie, welche Felder im Tab „Fachliche Details“ einer App angezeigt und bearbeitet werden können. Reihenfolge, Label und Schlüssel sind frei konfigurierbar."
          >
            <div className="flex flex-col gap-3">
              {settings.detailFields.map((field, idx) => {
                const patchField = (patch: Partial<DetailFieldDef>) => {
                  const fields = [...settings.detailFields];
                  fields[idx] = { ...fields[idx], ...patch };
                  setSettings({ ...settings, detailFields: fields });
                };
                const move = (delta: number) => {
                  const fields = [...settings.detailFields];
                  [fields[idx], fields[idx + delta]] = [fields[idx + delta], fields[idx]];
                  setSettings({ ...settings, detailFields: fields });
                };
                return (
                  <div key={idx} className="@container flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                    <div className="grid min-w-0 flex-1 gap-3 @xl:grid-cols-[14rem_minmax(0,1fr)]">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">Icon</span>
                        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg bg-card p-1.5 ring-1 ring-foreground/10">
                          {AVAILABLE_ICONS.map(({ name, component }) => (
                            <Tooltip key={name}>
                              <Tooltip.Trigger
                                render={
                                  <button
                                    type="button"
                                    aria-label={name}
                                    aria-pressed={field.icon === name}
                                    onClick={() => patchField({ icon: name })}
                                    className={`rounded p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${field.icon === name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                  />
                                }
                              >
                                {component}
                              </Tooltip.Trigger>
                              <Tooltip.Content>{name}</Tooltip.Content>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <Field>
                          <Field.Label>Bezeichnung</Field.Label>
                          <Input value={field.label} placeholder="z. B. Themenfeld" onChange={(event) => patchField({ label: event.target.value })} />
                        </Field>
                        <Field>
                          <Field.Label>Schlüssel (intern)</Field.Label>
                          <Input className="font-mono text-sm" value={field.key} placeholder="z. B. focus" onChange={(event) => patchField({ key: event.target.value.toLowerCase().replace(/\s+/g, "_") })} />
                        </Field>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Nach oben" disabled={idx === 0} onClick={() => move(-1)}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Nach unten" disabled={idx === settings.detailFields.length - 1} onClick={() => move(1)}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Feld entfernen" onClick={() => setSettings({ ...settings, detailFields: settings.detailFields.filter((_, i) => i !== idx) })}><Trash2 /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <SaveBar
              saving={saving}
              saved={savedSection === "detailFields"}
              label="Felder speichern"
              onSave={() => void save({ detailFields: settings.detailFields }, "detailFields")}
              start={
                <Button variant="secondary" onClick={() => setSettings({ ...settings, detailFields: [...settings.detailFields, { key: "", label: "" }] })}>
                  <Plus />
                  Feld hinzufügen
                </Button>
              }
            />
          </SettingsCard>
        )}

        {visibleSections.has("footer") && (
          <SettingsCard
            icon={<ExternalLink />}
            title="Footer – Links"
            description="Konfigurieren Sie die Links im Footer (z. B. Impressum, Datenschutz). Ohne Einträge werden die Standardlinks angezeigt."
          >
            <div className="flex flex-col gap-3">
              {settings.footerLinks.map((link, idx) => {
                const patchLink = (patch: Partial<FooterLink>) => {
                  const links = [...settings.footerLinks];
                  links[idx] = { ...links[idx], ...patch };
                  setSettings({ ...settings, footerLinks: links });
                };
                return (
                  <div key={idx} className="@container flex items-end gap-2 rounded-xl bg-muted/40 p-3">
                    <div className="grid min-w-0 flex-1 gap-3 @lg:grid-cols-2">
                      <Field>
                        <Field.Label>Bezeichnung</Field.Label>
                        <Input value={link.label} placeholder="z. B. Impressum" onChange={(event) => patchLink({ label: event.target.value })} />
                      </Field>
                      <Field>
                        <Field.Label>URL</Field.Label>
                        <Input className="font-mono text-sm" value={link.url} placeholder="https://example.com/impressum" onChange={(event) => patchLink({ url: event.target.value })} />
                      </Field>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Link entfernen" onClick={() => setSettings({ ...settings, footerLinks: settings.footerLinks.filter((_, i) => i !== idx) })}><Trash2 /></Button>
                  </div>
                );
              })}
              {settings.footerLinks.length === 0 && <p className="text-sm text-muted-foreground">Keine eigenen Links – es werden die Standardlinks angezeigt.</p>}
            </div>
            <SaveBar
              saving={saving}
              saved={savedSection === "footerLinks"}
              label="Links speichern"
              onSave={() => void save({ footerLinks: settings.footerLinks }, "footerLinks")}
              start={
                <Button variant="secondary" onClick={() => setSettings({ ...settings, footerLinks: [...settings.footerLinks, { label: "", url: "" }] })}>
                  <Plus />
                  Link hinzufügen
                </Button>
              }
            />
          </SettingsCard>
        )}

        {visibleSections.has("apps") && (
          <>
            <SettingsCard
              icon={<SortAsc />}
              title="App-Sortierung"
              description="Legen Sie fest, nach welchem Kriterium Apps standardmäßig sortiert werden und welche Apps immer oben erscheinen."
            >
              <div className="flex flex-col gap-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field>
                    <Field.Label>Sortierfeld</Field.Label>
                    <Select items={SORT_FIELDS} value={settings.appSortField} onValueChange={(value) => setSettings({ ...settings, appSortField: String(value) })}>
                      <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                      <Select.Content>{SORT_FIELDS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                    </Select>
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Richtung</span>
                    <div className="flex gap-2">
                      <Button variant={settings.appSortDirection === "asc" ? "default" : "secondary"} aria-pressed={settings.appSortDirection === "asc"} onClick={() => setSettings({ ...settings, appSortDirection: "asc" })}>
                        <SortAsc /> Aufsteigend
                      </Button>
                      <Button variant={settings.appSortDirection === "desc" ? "default" : "secondary"} aria-pressed={settings.appSortDirection === "desc"} onClick={() => setSettings({ ...settings, appSortDirection: "desc" })}>
                        <SortDesc /> Absteigend
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium">
                      <Pin className="size-3.5 text-muted-foreground" />
                      Angepinnte Apps
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      App-IDs, die unabhängig von der Sortierung immer an erster Stelle angezeigt werden. Die Reihenfolge entspricht der Anzeigereihenfolge.
                    </p>
                  </div>
                  {settings.pinnedApps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Apps angepinnt.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {settings.pinnedApps.map((appId, idx) => (
                        <li key={appId + idx} className="flex items-center gap-2 rounded-lg bg-muted/40 py-1.5 ps-3 pe-1.5">
                          <Pin className="size-3 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate font-mono text-sm">{appId}</span>
                          <Button variant="ghost" size="icon-sm" aria-label="Nach oben" disabled={idx === 0} onClick={() => {
                            const pins = [...settings.pinnedApps];
                            [pins[idx - 1], pins[idx]] = [pins[idx], pins[idx - 1]];
                            setSettings({ ...settings, pinnedApps: pins });
                          }}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Nach unten" disabled={idx === settings.pinnedApps.length - 1} onClick={() => {
                            const pins = [...settings.pinnedApps];
                            [pins[idx], pins[idx + 1]] = [pins[idx + 1], pins[idx]];
                            setSettings({ ...settings, pinnedApps: pins });
                          }}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`${appId} entfernen`} onClick={() => setSettings({ ...settings, pinnedApps: settings.pinnedApps.filter((_, i) => i !== idx) })}><Trash2 /></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const id = pinnedAppInput.trim();
                      if (id && !settings.pinnedApps.includes(id)) {
                        setSettings({ ...settings, pinnedApps: [...settings.pinnedApps, id] });
                        setPinnedAppInput("");
                      }
                    }}
                  >
                    <Input aria-label="App-ID" className="font-mono text-sm" value={pinnedAppInput} placeholder="App-ID eingeben (z. B. nextcloud)" onChange={(event) => setPinnedAppInput(event.target.value)} />
                    <Button type="submit" variant="secondary" className="shrink-0" disabled={!pinnedAppInput.trim() || settings.pinnedApps.includes(pinnedAppInput.trim())}>
                      <Plus /> Hinzufügen
                    </Button>
                  </form>
                </div>
              </div>
              <SaveBar
                saving={saving}
                saved={savedSection === "sort"}
                label="Sortierung speichern"
                onSave={() => void save({ appSortField: settings.appSortField, appSortDirection: settings.appSortDirection, pinnedApps: settings.pinnedApps }, "sort")}
              />
            </SettingsCard>

            <SettingsCard
              icon={<ExternalLink />}
              title="Link-Status-Prüfung"
              description="Wenn aktiviert, wird die Erreichbarkeit von Live-Demo-Links serverseitig geprüft und ein farbiger Status-Punkt angezeigt. Einzelne Apps können die Prüfung über ihre eigene Einstellung deaktivieren (z. B. bei Links hinter Authentifizierung)."
            >
              <ToggleRow
                title="Status-Prüfung aktivieren"
                description="Zeigt einen Erreichbarkeits-Indikator neben Live-Demo-Links an."
                checked={settings.enableLinkProbing}
                onChange={(value) => setSettings({ ...settings, enableLinkProbing: value })}
              />
              <SaveBar saving={saving} saved={savedSection === "linkProbing"} label="Speichern" onSave={() => void save({ enableLinkProbing: settings.enableLinkProbing }, "linkProbing")} />
            </SettingsCard>
          </>
        )}

        {visibleSections.has("integrationen") && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Verwalten Sie hier Repository-Provider vollständig in der Datenbank. Tokens werden verschlüsselt gespeichert und nach dem Speichern nicht mehr angezeigt.
              </p>
              <Button className="shrink-0" onClick={() => setCreateProviderModalOpen(true)}>
                <Plus />
                {savedSection === "gitlab-create" ? "Provider erstellt ✓" : "Neuer Provider"}
              </Button>
            </div>

            {gitLabProviderError && (
              <Alert variant="plain" tone="destructive">
                <Alert.Icon />
                <Alert.Title>{gitLabProviderError}</Alert.Title>
              </Alert>
            )}

            {gitLabProviders.length === 0 ? (
              <Alert variant="plain" tone="warning">
                <Alert.Icon />
                <Alert.Title>Es sind aktuell keine Repository-Provider in der Datenbank konfiguriert.</Alert.Title>
              </Alert>
            ) : (
              <div className="flex flex-col gap-4">
                {gitLabProviders.map((provider) => {
                  const linked = provider.linkedAppsCount || 0;
                  return (
                    <Card key={provider.providerKey} className="@container">
                      <Card.Header>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Card.Title>{provider.label || provider.providerKey}</Card.Title>
                              {provider.label && <code className="font-mono text-xs text-muted-foreground">{provider.providerKey}</code>}
                              {provider.providerType && (
                                <Badge variant="secondary" size="sm">
                                  {provider.providerType === "github" ? "GitHub" : provider.providerType === "gitlab" ? "GitLab" : provider.providerType}
                                </Badge>
                              )}
                              {linked > 0 && <Badge variant="warning" size="sm">{linked} {linked === 1 ? "App-Verknüpfung" : "App-Verknüpfungen"}</Badge>}
                              <Badge variant={provider.enabled ? "success" : "secondary"} size="sm">{provider.enabled ? "Aktiv" : "Deaktiviert"}</Badge>
                              <Badge variant={provider.autoSyncEnabled ? "info" : "secondary"} size="sm">{provider.autoSyncEnabled ? "Auto-Sync an" : "Auto-Sync aus"}</Badge>
                            </div>
                            <Card.Description>
                              {provider.tokenConfigured ? "Token verschlüsselt in der Datenbank gespeichert" : "Kein Token gespeichert"}
                              {provider.configured ? " · Provider aktiv konfiguriert" : " · Provider derzeit nicht vollständig nutzbar"}
                            </Card.Description>
                          </div>
                          <Tooltip>
                            <Tooltip.Trigger render={<span tabIndex={linked > 0 ? 0 : -1} />}>
                              <Button variant="ghost" size="icon-sm" aria-label={`${provider.providerKey} löschen`} disabled={saving || linked > 0} onClick={() => setProviderToDelete(provider)}>
                                <Trash2 />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>{linked > 0 ? "Verknüpfte Apps zuerst lösen, bevor der Provider gelöscht werden kann." : "Provider löschen"}</Tooltip.Content>
                          </Tooltip>
                        </div>
                      </Card.Header>
                      <Card.Content>
                        <RepositoryProviderFields
                          values={{
                            label: provider.label,
                            baseUrl: provider.baseUrl,
                            token: providerTokenDrafts[provider.providerKey] || "",
                            namespaceAllowlist: providerNamespaceAllowlistDrafts[provider.providerKey] ?? provider.namespaceAllowlist.join("\n"),
                            enabled: provider.enabled,
                            autoSyncEnabled: provider.autoSyncEnabled,
                            syncIntervalMinutes: provider.syncIntervalMinutes,
                            defaultReadmePath: provider.defaultReadmePath || "",
                            defaultHelmValuesPath: provider.defaultHelmValuesPath || "",
                            defaultComposeFilePath: provider.defaultComposeFilePath || "",
                          }}
                          onChange={(patch) => {
                            const { token, namespaceAllowlist, ...rest } = patch;
                            if (token !== undefined) updateProviderTokenDraft(provider.providerKey, token);
                            if (namespaceAllowlist !== undefined) setProviderNamespaceAllowlistDrafts((prev) => ({ ...prev, [provider.providerKey]: namespaceAllowlist }));
                            if (Object.keys(rest).length) updateGitLabProvider(provider.providerKey, rest);
                          }}
                          tokenLabel="Token ersetzen"
                          tokenPlaceholder={provider.tokenConfigured ? "Neuen Token eingeben, um den bestehenden zu ersetzen" : "Token eingeben"}
                          tokenStatus={
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">
                                {provider.tokenConfigured
                                  ? "Ein Token ist gespeichert. Beim Ersetzen wird der alte Token überschrieben."
                                  : "Aktuell ist kein Token gespeichert. Ohne Token ist der Provider nicht für den Sync nutzbar."}
                              </p>
                              {provider.tokenConfigured && (
                                <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void saveGitLabProvider(provider, { clearToken: true })}>
                                  Token löschen
                                </Button>
                              )}
                            </div>
                          }
                        />
                      </Card.Content>
                      <Card.Footer className="justify-end">
                        <Button loading={saving} onClick={() => void saveGitLabProvider(provider)}>
                          {savedSection === `gitlab-${provider.providerKey}` ? "Gespeichert ✓" : "Provider speichern"}
                        </Button>
                      </Card.Footer>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {visibleSections.has("ai-access") && (
          <SettingsCard icon={<Bot />} title="AI-Zugriff">
            <div className="flex flex-col gap-3">
              <ToggleRow
                title="AI-Funktion aktivieren"
                description="Schaltet den AI-Chat, das Floating-Widget und die zugehörigen API-Endpunkte global ein oder aus."
                checked={settings.aiEnabled}
                pending={saving}
                onChange={(value) => void save({ aiEnabled: value }, "aiEnabled")}
              />
              <ToggleRow
                title="Anonymen AI-Zugriff erlauben"
                description="Erlaubt nicht angemeldeten Besuchern den Zugriff auf den AI-Chat und das Floating-Widget. Der Verlauf bleibt nur lokal im Browser gespeichert."
                checked={settings.allowAnonymousAI}
                disabled={!settings.aiEnabled}
                pending={saving}
                onChange={(value) => void save({ allowAnonymousAI: value }, "anonymousAI")}
              />
              {!settings.aiEnabled && (
                <p className="text-xs text-muted-foreground">
                  Die AI-Provider-Konfiguration bleibt erhalten und wird wieder verwendet, sobald die Funktion erneut aktiviert wird.
                </p>
              )}
            </div>
          </SettingsCard>
        )}

        {visibleSections.has("ai") && <AIProviderSettingsPanel />}
      </div>

      <Dialog open={createProviderModalOpen} onOpenChange={(open) => { if (!open && !saving) closeCreateProviderModal(); }}>
        <Dialog.Content size="lg">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void createGitLabProvider();
            }}
          >
            <Dialog.Header
              title="Neuen Repository-Provider anlegen"
              description="Schlüssel und Typ werden beim Erstellen festgelegt und anschließend nicht mehr geändert. Tokens werden verschlüsselt gespeichert."
            />
            <Dialog.Body className="@container flex flex-col gap-4">
              {gitLabProviderError && (
                <Alert variant="plain" tone="destructive">
                  <Alert.Icon />
                  <Alert.Title>{gitLabProviderError}</Alert.Title>
                </Alert>
              )}
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <Field>
                  <Field.Label required>Provider-Schlüssel</Field.Label>
                  <Input required className="font-mono text-sm" value={newProvider.providerKey} placeholder="z. B. github-com" onChange={(event) => setNewProvider((prev) => ({ ...prev, providerKey: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>Provider-Typ</Field.Label>
                  <Select
                    items={PROVIDER_TYPES}
                    value={newProvider.providerType}
                    onValueChange={(value) => {
                      const providerType = String(value) as ProviderDraftState["providerType"];
                      setNewProvider((prev) => ({
                        ...prev,
                        providerType,
                        baseUrl: prev.baseUrl.trim() === "" || prev.baseUrl === defaultBaseUrlForProviderType(prev.providerType) ? defaultBaseUrlForProviderType(providerType) : prev.baseUrl,
                      }));
                    }}
                  >
                    <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                    <Select.Content>{PROVIDER_TYPES.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                  </Select>
                </Field>
              </div>
              <RepositoryProviderFields
                values={newProvider}
                onChange={(patch) => setNewProvider((prev) => ({ ...prev, ...patch }))}
                tokenLabel="Token"
                tokenPlaceholder="Personal Access Token"
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="secondary" disabled={saving} onClick={closeCreateProviderModal}>Abbrechen</Button>
              <Button type="submit" loading={saving} disabled={!newProvider.providerKey.trim() || !newProvider.baseUrl.trim() || !newProvider.token.trim()}>
                <Plus />
                Provider anlegen
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Provider löschen"
        description={providerToDelete ? `Der Provider ${providerToDelete.providerKey} wird dauerhaft entfernt. Verknüpfte Apps verhindern das Löschen automatisch.` : ""}
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
