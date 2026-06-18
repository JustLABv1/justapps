import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export interface LiveDemo {
  label: string;
  url: string;
}

export interface AppLink {
  label: string;
  url: string;
}

export interface AppField {
  key: string;
  value: string;
}

export interface DeploymentVariant {
  name: string;
  description: string;
  dockerCommand?: string;
  dockerNote?: string;
  composeCommand?: string;
  composeNote?: string;
  helmCommand?: string;
  helmNote?: string;
  helmValues?: string;
}

export interface GitLabProviderSummary {
  key: string;
  type?: string;
  label: string;
  baseUrl: string;
  autoSyncEnabled?: boolean;
  syncIntervalMinutes?: number;
  defaultReadmePath?: string;
  defaultHelmValuesPath?: string;
  defaultComposeFilePath?: string;
  namespaceAllowlist?: string[];
}

export interface GitLabProviderAdminSettings {
  providerKey: string;
  providerType?: string;
  label: string;
  baseUrl: string;
  linkedAppsCount?: number;
  namespaceAllowlist: string[];
  enabled: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  defaultReadmePath?: string;
  defaultHelmValuesPath?: string;
  defaultComposeFilePath?: string;
  configured: boolean;
  tokenConfigured: boolean;
}

export interface OIDCProviderSummary {
  key: string;
  label: string;
  issuer: string;
  clientId: string;
  adminGroup: string;
  insecure: boolean;
  disableLocalAuth: boolean;
  scopes: string[];
  configured: boolean;
}

export interface OIDCProviderAdminSettings {
  providerKey: string;
  label: string;
  issuer: string;
  clientId: string;
  adminGroup: string;
  enabled: boolean;
  insecure: boolean;
  disableLocalAuth: boolean;
  scopes: string[];
  configured: boolean;
  secretConfigured: boolean;
}

export interface GitLabSyncSnapshot {
  projectId?: number;
  projectName?: string;
  projectPath?: string;
  projectWebUrl?: string;
  defaultBranch?: string;
  description?: string;
  topics?: string[];
  license?: string;
  lastActivityAt?: string;
  readmePath?: string;
  readmeContent?: string;
  helmValuesPath?: string;
  helmValuesContent?: string;
  composeFilePath?: string;
  composeFileContent?: string;
  warnings?: string[];
  syncedAt?: string;
}

export interface GitLabIntegrationState {
  linked: boolean;
  availableProviders: GitLabProviderSummary[];
  providerKey?: string;
  providerType?: string;
  providerLabel?: string;
  baseUrl?: string;
  projectPath?: string;
  projectWebUrl?: string;
  branch?: string;
  readmePath?: string;
  helmValuesPath?: string;
  composeFilePath?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  approvalRequired?: boolean;
  lastSyncedAt?: string;
  lastAppliedAt?: string;
  lastManualChangeAt?: string;
  snapshot?: GitLabSyncSnapshot;
  pendingSnapshot?: GitLabSyncSnapshot;
}

export interface GitLabSyncSummary {
  linked: boolean;
  providerKey?: string;
  providerType?: string;
  projectPath?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  approvalRequired: boolean;
  lastSyncedAt?: string;
}

export interface AppViewerPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canManageEditors: boolean;
  accessRole: 'admin' | 'owner' | 'editor' | 'viewer' | string;
}

export interface AppRelease {
  id: string;
  appId: string;
  version: string;
  releaseType: 'patch' | 'minor' | 'major' | string;
  source: string;
  title: string;
  summary: string;
  changedAreas: string[];
  changeDetails: ReleaseChangeDetail[];
  diffPreview: string;
  fingerprint: string;
  publishedAt: string;
  createdAt: string;
}

export interface ReleaseChangeDetail {
  area: string;
  field: string;
  label: string;
  language: string;
  preview: string;
  diff: string;
  beforeText: string;
  afterText: string;
}

export interface UpdatePreferences {
  userId: string;
  notifyFavoritedApps: boolean;
  notifyRecentlyViewedApps: boolean;
  notifyOwnedManagedApps: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseInboxItem {
  id: string;
  releaseId: string;
  appId: string;
  appName: string;
  appIcon?: string;
  version: string;
  releaseType: 'patch' | 'minor' | 'major' | string;
  title: string;
  summary: string;
  changedAreas: string[];
  changeDetails: ReleaseChangeDetail[];
  diffPreview: string;
  reason: string;
  publishedAt: string;
  seenAt?: string | null;
}

export interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: string;
  authType?: string;
  canSubmitApps?: boolean;
  disabled?: boolean;
}

export type AppEditorUser = SystemUser;

export interface AppUserSummary {
  id: string;
  username: string;
  email: string;
}

export interface AppCatalogFilters {
  q: string;
  status: string;
  category: string;
  ownerId: string;
  hasEditors: string;
  syncStatus: string;
  featured: string;
  locked: string;
  visibility: string;
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  categories: string[];
  liveUrl?: string; // Kept for backwards compatibility
  liveDemos?: LiveDemo[];
  repoUrl?: string;
  repositories?: AppLink[];
  customLinks?: AppLink[];
  helmRepo?: string;
  dockerRepo?: string;
  docsUrl?: string;
  icon?: string;
  techStack?: string[];
  license?: string;
  markdownContent?: string;
  /** Dynamic "Fachliche Details" key-value pairs. Schema is defined in platform settings. */
  customFields?: AppField[];
  status?: string;
  customDockerCommand?: string;
  customComposeCommand?: string;
  customHelmCommand?: string;
  customDockerNote?: string;
  customComposeNote?: string;
  customHelmNote?: string;
  customHelmValues?: string;
  hasDeploymentAssistant?: boolean;
  showDocker?: boolean;
  showCompose?: boolean;
  showHelm?: boolean;
  isLocked?: boolean;
  isReuse?: boolean;
  reuseRequirements?: string;
  ownerId?: string;
  owner?: AppUserSummary;
  editors?: AppUserSummary[];
  tags?: string[];
  collections?: string[];
  isFeatured?: boolean;
  bannerText?: string;
  bannerType?: 'info' | 'warning' | 'danger' | 'custom';
  /** Only used when bannerType is 'custom'. Expected format: #RRGGBB. */
  bannerColor?: string;
  /** Optional override for the banner heading. Defaults to the type label (Info/Warnung/Kritisch). */
  bannerTitle?: string;
  /** @deprecated Use bannerText + bannerType instead. Accepted as legacy input only. */
  knownIssue?: string;
  authority?: string;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: string;
  updatedAt?: string;
  deploymentVariants?: DeploymentVariant[];
  version?: string;
  changelog?: string;
  // Related apps (populated by GetApp)
  relatedApps?: { id: string; name: string; icon?: string }[];
  // Groups this app belongs to
  appGroups?: { id: string; name: string; icon?: string }[];
  gitLabSync?: GitLabSyncSummary;
  viewerPermissions?: AppViewerPermissions;
  /** Opt out of the global link-probing feature for this app (e.g. links behind auth/VPN) */
  skipLinkProbe?: boolean;
  /** Backend-maintained reachability status for live endpoints. */
  linkProbeStatus?: 'ok' | 'partial' | 'down' | 'unknown';
}

export const getApps = (): AppConfig[] => {
  try {
    const configPath = process.env.APP_CONFIG_PATH || 'config.yaml';
    const filePath = path.isAbsolute(configPath) 
      ? configPath 
      : path.join(process.cwd(), configPath);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Config file not found at ${filePath}, returning empty list`);
      return [];
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents) as { apps: AppConfig[] };
    return data.apps || [];
  } catch (error) {
    console.error('Error loading apps from config:', error);
    return [];
  }
};

export const apps: AppConfig[] = []; // Keep as fallback or for types if needed
