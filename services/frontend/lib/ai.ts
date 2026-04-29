import { fetchApi } from './api';

export interface AIProviderSummary {
  key: string;
  type: string;
  label: string;
  chatModel: string;
  baseUrl?: string;
  default: boolean;
  tokenConfigured: boolean;
}

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

export interface AIMessageSource {
  appId: string;
  appName: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  score?: number;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  providerKey?: string;
  providerType?: string;
  model?: string;
  promptTokens?: number;
  responseTokens?: number;
  sources?: AIMessageSource[];
  error?: string;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  scopeType: string;
  appId?: string;
  createdAt: string;
  updatedAt: string;
  messages?: AIMessage[];
}

export interface AISendMessageResponse {
  conversation: AIConversation;
  userMessage: AIMessage;
  assistantMessage: AIMessage;
  sources: AIMessageSource[];
}

export interface AISendMessagePayload {
  conversationId?: string;
  message: string;
  appId?: string;
  providerKey?: string;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
  const message = data.message?.trim();
  const detail = data.error?.trim();
  if (message && detail && detail !== message) return new Error(`${message}: ${detail}`);
  return new Error(message || detail || fallback);
}

export async function listAIProviders(): Promise<AIProviderSummary[]> {
  const response = await fetchApi('/ai/providers', { cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'AI-Provider konnten nicht geladen werden.');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function listAIConversations(): Promise<AIConversation[]> {
  const response = await fetchApi('/ai/conversations', { cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'Konversationen konnten nicht geladen werden.');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function getAIConversation(id: string): Promise<AIConversation> {
  const response = await fetchApi(`/ai/conversations/${id}`, { cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'Konversation konnte nicht geladen werden.');
  return response.json();
}

export async function deleteAIConversation(id: string): Promise<void> {
  const response = await fetchApi(`/ai/conversations/${id}`, { method: 'DELETE' });
  if (!response.ok) throw await parseError(response, 'Konversation konnte nicht gelöscht werden.');
}

export async function sendAIMessage(payload: AISendMessagePayload): Promise<AISendMessageResponse> {
  const endpoint = payload.conversationId
    ? `/ai/conversations/${payload.conversationId}/messages`
    : '/ai/chat';
  const response = await fetchApi(endpoint, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await parseError(response, 'AI-Antwort konnte nicht erzeugt werden.');
  return response.json();
}

export async function listAIProviderSettings(): Promise<AIProviderAdminSettings[]> {
  const response = await fetchApi('/settings/ai-providers', { cache: 'no-store' });
  if (!response.ok) throw await parseError(response, 'AI-Provider konnten nicht geladen werden.');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function reindexAIKnowledge(): Promise<{ indexedApps: number }> {
  const response = await fetchApi('/ai/knowledge/reindex', { method: 'POST' });
  if (!response.ok) throw await parseError(response, 'AI-Wissensindex konnte nicht aufgebaut werden.');
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