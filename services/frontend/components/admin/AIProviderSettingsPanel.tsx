'use client';

import {
    AI_PROVIDER_TYPES,
    AIProviderAdminSettings,
    AIProviderType,
    aiProviderTypeLabel,
    defaultAIBaseUrl,
    defaultAIModel,
    listAIProviderSettings,
    reindexAIKnowledge,
} from '@/lib/ai';
import { fetchApi } from '@/lib/api';
import { Button, Input, Label, ListBox, Modal, Select, Surface, Switch, TextField, Tooltip } from '@heroui/react';
import { Bot, DatabaseZap, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type ProviderDraft = {
  providerKey: string;
  providerType: AIProviderType;
  label: string;
  baseUrl: string;
  apiPath: string;
  apiVersion: string;
  region: string;
  organization: string;
  token: string;
  chatModel: string;
  embeddingModel: string;
  enabled: boolean;
  isDefault: boolean;
  timeoutSeconds: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  temperature: number;
};

const defaultDraft = (): ProviderDraft => ({
  providerKey: '',
  providerType: 'openai-compatible',
  label: '',
  baseUrl: '',
  apiPath: '',
  apiVersion: '',
  region: '',
  organization: '',
  token: '',
  chatModel: defaultAIModel('openai-compatible'),
  embeddingModel: '',
  enabled: true,
  isDefault: false,
  timeoutSeconds: 30,
  maxContextTokens: 6000,
  maxOutputTokens: 1200,
  temperature: 0.2,
});

async function parseApiError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  return new Error((data as { message?: string; error?: string }).message || (data as { error?: string }).error || fallback);
}

export function AIProviderSettingsPanel() {
  const [providers, setProviders] = useState<AIProviderAdminSettings[]>([]);
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderDraft>(defaultDraft);
  const [providerToDelete, setProviderToDelete] = useState<AIProviderAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => {
    const data = await listAIProviderSettings();
    setProviders(data);
  };

  useEffect(() => {
    loadProviders()
      .catch((err) => setError(err instanceof Error ? err.message : 'AI-Provider konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const updateProvider = (providerKey: string, patch: Partial<AIProviderAdminSettings>) => {
    setProviders((current) => current.map((provider) => provider.providerKey === providerKey ? { ...provider, ...patch } : provider));
  };

  const createProvider = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi('/settings/ai-providers', {
        method: 'POST',
        body: JSON.stringify(newProvider),
      });
      if (!response.ok) throw await parseApiError(response, 'AI-Provider konnte nicht erstellt werden.');
      await loadProviders();
      setCreateOpen(false);
      setNewProvider(defaultDraft());
      setStatus('AI-Provider erstellt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Provider konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  };

  const saveProvider = async (provider: AIProviderAdminSettings, options?: { clearToken?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(`/settings/ai-providers/${provider.providerKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...provider,
          token: options?.clearToken ? '' : tokenDrafts[provider.providerKey] || '',
          clearToken: options?.clearToken || false,
        }),
      });
      if (!response.ok) throw await parseApiError(response, 'AI-Provider konnte nicht gespeichert werden.');
      await loadProviders();
      setTokenDrafts((current) => {
        const next = { ...current };
        delete next[provider.providerKey];
        return next;
      });
      setStatus('AI-Provider gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Provider konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async () => {
    if (!providerToDelete) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(`/settings/ai-providers/${providerToDelete.providerKey}`, { method: 'DELETE' });
      if (!response.ok) throw await parseApiError(response, 'AI-Provider konnte nicht gelöscht werden.');
      setProviders((current) => current.filter((provider) => provider.providerKey !== providerToDelete.providerKey));
      setProviderToDelete(null);
      setStatus('AI-Provider gelöscht.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Provider konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (providerKey: string) => {
    setTestingProvider(providerKey);
    setError(null);
    setStatus(null);
    try {
      const response = await fetchApi(`/settings/ai-providers/${providerKey}/test`, { method: 'POST' });
      if (!response.ok) throw await parseApiError(response, 'AI-Provider konnte nicht getestet werden.');
      const data = await response.json() as { ok: boolean; message?: string };
      setStatus(data.ok ? 'AI-Provider erreichbar.' : data.message || 'AI-Provider-Test fehlgeschlagen.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Provider konnte nicht getestet werden.');
    } finally {
      setTestingProvider(null);
    }
  };

  const runReindex = async () => {
    setReindexing(true);
    setError(null);
    try {
      const result = await reindexAIKnowledge();
      setStatus(`${result.indexedApps} Apps indexiert.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Wissensindex konnte nicht aufgebaut werden.');
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Surface className="border border-border/50 p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
              <Bot className="h-4 w-4 text-accent" /> AI-Provider
            </h3>
            <p className="mt-1 text-xs text-muted">Tokens werden verschlüsselt gespeichert und nach dem Speichern nicht mehr angezeigt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" isDisabled={reindexing} onPress={runReindex}>
              {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
              Index neu aufbauen
            </Button>
            <Button className="bg-accent text-white" onPress={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Provider anlegen
            </Button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>}
        {status && <div className="mb-4 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">{status}</div>}

        {providers.length === 0 ? (
          <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning">Es ist aktuell kein AI-Provider konfiguriert.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {providers.map((provider) => (
              <div key={provider.providerKey} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{provider.providerKey}</p>
                      <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                        {aiProviderTypeLabel(provider.providerType)}
                      </span>
                      {provider.isDefault && <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Standard</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {provider.tokenConfigured ? 'Token gespeichert' : provider.requiresToken ? 'Token erforderlich' : 'Token optional'} · {provider.chatModel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" isDisabled={testingProvider === provider.providerKey} onPress={() => void testProvider(provider.providerKey)}>
                      {testingProvider === provider.providerKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Test
                    </Button>
                    <Tooltip delay={0}>
                      <Tooltip.Trigger>
                        <div>
                          <Button isIconOnly size="sm" variant="secondary" className="text-danger" onPress={() => setProviderToDelete(provider)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Provider löschen</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TextField value={provider.label} onChange={(value) => updateProvider(provider.providerKey, { label: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Bezeichnung</Label>
                    <Input className="bg-field-background" placeholder="Interner Chat Provider" />
                  </TextField>
                  <TextField value={provider.baseUrl} onChange={(value) => updateProvider(provider.providerKey, { baseUrl: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Base URL</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="https://api.example.com/v1" />
                  </TextField>
                  <TextField value={provider.apiPath || ''} onChange={(value) => updateProvider(provider.providerKey, { apiPath: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">API-Pfad</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="optional" />
                  </TextField>
                  <TextField value={provider.chatModel} onChange={(value) => updateProvider(provider.providerKey, { chatModel: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Chat-Modell</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="gpt-4o-mini" />
                  </TextField>
                  <TextField value={provider.apiVersion || ''} onChange={(value) => updateProvider(provider.providerKey, { apiVersion: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">API-Version</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="2024-10-21" />
                  </TextField>
                  <TextField value={provider.organization || ''} onChange={(value) => updateProvider(provider.providerKey, { organization: value })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Organisation</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="optional" />
                  </TextField>
                  <TextField value={tokenDrafts[provider.providerKey] || ''} onChange={(value) => setTokenDrafts((current) => ({ ...current, [provider.providerKey]: value }))}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">API-Key ersetzen</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder={provider.tokenConfigured ? 'Neuen Key eingeben' : provider.requiresToken ? 'API-Key eingeben' : 'Optional'} type="password" />
                  </TextField>
                  <TextField value={String(provider.temperature)} onChange={(value) => updateProvider(provider.providerKey, { temperature: Number.parseFloat(value || '0.2') || 0.2 })}>
                    <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Temperatur</Label>
                    <Input className="bg-field-background font-mono text-sm" placeholder="0.2" />
                    <p className="mt-1 ml-1 text-[11px] text-muted">Bestimmt die Kreativität der Antworten. 0 = sehr deterministisch und faktentreu, 1 = ausgewogen, &gt;1 = experimentell und variabler. Empfohlen: 0.1–0.3 für Wissensfragen.</p>
                  </TextField>

                  <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Aktiv</p>
                        <p className="text-xs text-muted">Im AI Chat auswählbar</p>
                      </div>
                      <Switch isSelected={provider.enabled} onChange={(value) => updateProvider(provider.providerKey, { enabled: value })}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Standard</p>
                        <p className="text-xs text-muted">Vorauswahl für neue Chats</p>
                      </div>
                      <Switch isSelected={provider.isDefault} onChange={(value) => updateProvider(provider.providerKey, { isDefault: value })}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                  <Button variant="secondary" className="text-danger" isDisabled={saving || !provider.tokenConfigured || provider.requiresToken} onPress={() => void saveProvider(provider, { clearToken: true })}>
                    Token löschen
                  </Button>
                  <Button className="bg-accent text-white" isDisabled={saving} onPress={() => void saveProvider(provider)}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Provider speichern
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <Modal.Backdrop isOpen={createOpen} onOpenChange={(open) => { if (!open) setCreateOpen(false); }}>
        <Modal.Container>
          <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-accent"><Bot className="h-5 w-5" /></Modal.Icon>
              <Modal.Heading>AI-Provider anlegen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TextField value={newProvider.providerKey} onChange={(value) => setNewProvider((current) => ({ ...current, providerKey: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Provider-Schlüssel</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="vllm-local" />
                </TextField>
                <Select
                  selectedKey={newProvider.providerType}
                  onSelectionChange={(key) => {
                    const providerType = String(key) as AIProviderType;
                    setNewProvider((current) => ({
                      ...current,
                      providerType,
                      baseUrl: defaultAIBaseUrl(providerType),
                      chatModel: defaultAIModel(providerType),
                    }));
                  }}
                >
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Provider-Typ</Label>
                  <Select.Trigger className="bg-field-background"><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {AI_PROVIDER_TYPES.map((providerType) => (
                        <ListBox.Item key={providerType} id={providerType} textValue={aiProviderTypeLabel(providerType)}>
                          {aiProviderTypeLabel(providerType)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField value={newProvider.label} onChange={(value) => setNewProvider((current) => ({ ...current, label: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Bezeichnung</Label>
                  <Input className="bg-field-background" placeholder="Lokales vLLM" />
                </TextField>
                <TextField value={newProvider.baseUrl} onChange={(value) => setNewProvider((current) => ({ ...current, baseUrl: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Base URL</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="http://localhost:8000/v1" />
                </TextField>
                <TextField value={newProvider.chatModel} onChange={(value) => setNewProvider((current) => ({ ...current, chatModel: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Chat-Modell</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="local-model" />
                </TextField>
                <TextField value={newProvider.token} onChange={(value) => setNewProvider((current) => ({ ...current, token: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">API-Key</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="Optional für lokale Provider" type="password" />
                </TextField>
                <TextField value={newProvider.apiVersion} onChange={(value) => setNewProvider((current) => ({ ...current, apiVersion: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">API-Version</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="optional" />
                </TextField>
                <TextField value={newProvider.organization} onChange={(value) => setNewProvider((current) => ({ ...current, organization: value }))}>
                  <Label className="mb-1.5 ml-1 text-[10px] font-bold uppercase tracking-widest text-muted">Organisation</Label>
                  <Input className="bg-field-background font-mono text-sm" placeholder="optional" />
                </TextField>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setCreateOpen(false)}>Abbrechen</Button>
              <Button className="bg-accent text-white" isDisabled={saving || !newProvider.providerKey.trim() || !newProvider.chatModel.trim()} onPress={() => void createProvider()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Provider anlegen
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={providerToDelete !== null} onOpenChange={(open) => { if (!open) setProviderToDelete(null); }}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-danger/10 text-danger"><Trash2 className="h-5 w-5" /></Modal.Icon>
              <Modal.Heading>AI-Provider löschen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">{providerToDelete?.providerKey}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setProviderToDelete(null)}>Abbrechen</Button>
              <Button variant="danger" isDisabled={saving} onPress={() => void deleteProvider()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Löschen
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
