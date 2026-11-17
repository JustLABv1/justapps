import { fetchApi } from './api';
import type { AppLink, GitLabSyncSnapshot } from '@/config/apps';

export interface AIProviderAdminSettings {
  providerKey: string;
  providerType: string;
  label: string;
  baseUrl: string;
  apiPath: string;
  apiVersion: string;
  region: string;
  organization: string;
  chatModel: string;
  embeddingModel: string;
  enabled: boolean;
  isDefault: boolean;
  configured: boolean;
  tokenConfigured: boolean;
  requiresToken: boolean;
  timeoutSeconds: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  temperature: number;
}

export interface ChangelogSuggestion {
  title: string;
  summary: string;
  changelog: string;
}

export interface HealthCopilotIssue {
  code: string;
  title: string;
  explanation: string;
  evidence: string;
  actions: string[];
}

export interface HealthCopilotSuggestion {
  appId: string;
  name: string;
  summary: string;
  priority: 'low' | 'medium' | 'high' | string;
  issues: HealthCopilotIssue[];
}

export interface AppCreationSuggestion {
  name: string;
  id: string;
  description: string;
  categories: string[];
  tags: string[];
  techStack: string[];
  license: string;
  isReuse: boolean;
  reuseRequirements: string;
  markdownContent: string;
  dockerRepo: string;
  customDockerCommand: string;
  customComposeCommand: string;
  helmRepo: string;
  customHelmCommand: string;
  customHelmValues: string;
  missingFields: string[];
  notes: string[];
}

export interface AppCreationRepositoryScan {
  providerKey: string;
  providerType: string;
  providerLabel: string;
  projectPath: string;
  branch: string;
  readmePath: string;
  helmValuesPath: string;
  composeFilePath: string;
  status: string;
  warnings: string[];
}

export interface AppCreationSuggestionResponse extends AppCreationSuggestion {
  repositorySnapshot?: GitLabSyncSnapshot;
  repositoryScan?: AppCreationRepositoryScan;
}

export interface AppCreationSuggestionPayload {
  brief?: string;
  name?: string;
  description?: string;
  markdownContent?: string;
  scanRepository?: boolean;
  repository?: {
    providerKey?: string;
    projectPath?: string;
    branch?: string;
    readmePath?: string;
    helmValuesPath?: string;
    composeFilePath?: string;
    readmeContent?: string;
    topics?: string[];
    helmValuesContent?: string;
    composeFileContent?: string;
  };
}

export interface ChangelogSuggestionPayload {
  appId?: string;
  name: string;
  version?: string;
  currentChangelog?: string;
  description?: string;
  license?: string;
  markdownContent?: string;
  customHelmValues?: string;
  customComposeCommand?: string;
  tags?: string[];
  repositories?: AppLink[];
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
  const message = data.message?.trim();
  const detail = data.error?.trim();
  if (message && detail && detail !== message) return new Error(`${message}: ${detail}`);
  return new Error(message || detail || fallback);
}

export async function suggestChangelog(payload: ChangelogSuggestionPayload): Promise<ChangelogSuggestion> {
  const response = await fetchApi('/apps/changelog/suggest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response, 'AI-Changelog konnte nicht erzeugt werden.');
  return response.json() as Promise<ChangelogSuggestion>;
}

export async function explainAppHealth(appId: string): Promise<HealthCopilotSuggestion> {
  const response = await fetchApi(`/apps/${encodeURIComponent(appId)}/health/copilot`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!response.ok) throw await parseError(response, 'AI-Erklärung konnte nicht erzeugt werden.');
  return response.json() as Promise<HealthCopilotSuggestion>;
}

export async function suggestAppCreation(payload: AppCreationSuggestionPayload): Promise<AppCreationSuggestionResponse> {
  const response = await fetchApi('/apps/creation/suggest', {
    method: 'POST',
    body: JSON.stringify(payload),
    suppressServerErrorReport: true,
  });
  if (!response.ok) throw await parseError(response, 'AI-App-Vorschlag konnte nicht erzeugt werden.');
  return response.json() as Promise<AppCreationSuggestionResponse>;
}

export interface CatalogStewardFinding {
  appId: string;
  appName: string;
  kind: string;
  severity: 'low' | 'medium' | 'high' | string;
  title: string;
  summary: string;
  evidence: string[];
  suggestions: string[];
  relatedAppIds: string[];
}

export interface CatalogStewardReport {
  generatedAt: string;
  appsScanned: number;
  summary: string;
  findings: CatalogStewardFinding[];
}

export async function runCatalogSteward(): Promise<CatalogStewardReport> {
  const response = await fetchApi('/admin/catalog/steward', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!response.ok) throw await parseError(response, 'AI-Katalogprüfung konnte nicht erzeugt werden.');
  return response.json() as Promise<CatalogStewardReport>;
}

export async function listAIProviderSettings(): Promise<AIProviderAdminSettings[]> {
  const response = await fetchApi('/settings/ai-providers', { cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'AI-Provider konnten nicht geladen werden.');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function reindexAIKnowledge(): Promise<{ indexedApps: number }> {
  const response = await fetchApi('/ai/knowledge/reindex', { method: 'POST' });
  if (!response.ok) throw await parseError(response, 'Suchindex konnte nicht aufgebaut werden.');
  return response.json();
}

export const AI_PROVIDER_TYPES = [
  'openai',
  'azure-openai',
  'anthropic',
  'gemini',
  'mistral',
  'cohere',
  'ollama',
  'vllm',
  'openai-compatible',
  'openrouter',
  'lmstudio',
  'together',
] as const;

export type AIProviderType = typeof AI_PROVIDER_TYPES[number];

export function aiProviderTypeLabel(providerType: string): string {
  switch (providerType) {
    case 'openai':
      return 'OpenAI';
    case 'azure-openai':
      return 'Azure OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'gemini':
      return 'Google Gemini';
    case 'mistral':
      return 'Mistral';
    case 'cohere':
      return 'Cohere';
    case 'ollama':
      return 'Ollama';
    case 'vllm':
      return 'vLLM';
    case 'openrouter':
      return 'OpenRouter';
    case 'lmstudio':
      return 'LM Studio';
    case 'together':
      return 'Together AI';
    default:
      return 'OpenAI-kompatibel';
  }
}


export function defaultAIBaseUrl(providerType: string): string {
  switch (providerType) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com';
    case 'mistral':
      return 'https://api.mistral.ai/v1';
    case 'cohere':
      return 'https://api.cohere.com';
    case 'ollama':
      return 'http://localhost:11434';
    case 'vllm':
      return 'http://localhost:8000/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'lmstudio':
      return 'http://localhost:1234/v1';
    case 'together':
      return 'https://api.together.xyz/v1';
    default:
      return '';
  }
}

export function defaultAIModel(providerType: string): string {
  switch (providerType) {
    case 'openai':
    case 'openai-compatible':
    case 'openrouter':
    case 'together':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-latest';
    case 'gemini':
      return 'gemini-1.5-flash';
    case 'mistral':
      return 'mistral-small-latest';
    case 'cohere':
      return 'command-r';
    case 'ollama':
      return 'llama3.1';
    default:
      return 'local-model';
  }
}
