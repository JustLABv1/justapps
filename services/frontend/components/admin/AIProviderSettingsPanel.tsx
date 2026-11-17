"use client";

import {
    AI_PROVIDER_TYPES,
    AIProviderAdminSettings,
    AIProviderType,
    aiProviderTypeLabel,
    defaultAIBaseUrl,
    defaultAIModel,
    listAIProviderSettings,
    reindexAIKnowledge,
} from "@/lib/ai";
import { fetchApi } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Switch } from "@/components/panelui/switch";
import { Tooltip } from "@/components/panelui/tooltip";
import { Bot, DatabaseZap, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

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
  providerKey: "",
  providerType: "openai-compatible",
  label: "",
  baseUrl: "",
  apiPath: "",
  apiVersion: "",
  region: "",
  organization: "",
  token: "",
  chatModel: defaultAIModel("openai-compatible"),
  embeddingModel: "",
  enabled: true,
  isDefault: false,
  timeoutSeconds: 30,
  maxContextTokens: 6000,
  maxOutputTokens: 1200,
  temperature: 0.2,
});

async function parseApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  return new Error(
    (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error ||
      fallback,
  );
}

export function AIProviderSettingsPanel() {
  const [providers, setProviders] = useState<AIProviderAdminSettings[]>([]);
  const [temperatureDrafts, setTemperatureDrafts] = useState<Record<string, string>>({});
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<ProviderDraft>(defaultDraft);
  const [providerToDelete, setProviderToDelete] =
    useState<AIProviderAdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = async () => listAIProviderSettings();

  useEffect(() => {
    loadProviders()
      .then((data) => setProviders(data))
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "AI-Provider konnten nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const updateProvider = (
    providerKey: string,
    patch: Partial<AIProviderAdminSettings>,
  ) => {
    setProviders((current) =>
      current.map((provider) =>
        provider.providerKey === providerKey
          ? { ...provider, ...patch }
          : provider,
      ),
    );
  };

  const createProvider = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi("/settings/ai-providers", {
        method: "POST",
        body: JSON.stringify(newProvider),
      });
      if (!response.ok)
        throw await parseApiError(
          response,
          "AI-Provider konnte nicht erstellt werden.",
        );
      setProviders(await loadProviders());
      setCreateOpen(false);
      setNewProvider(defaultDraft());
      setStatus("AI-Provider erstellt.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI-Provider konnte nicht erstellt werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveProvider = async (
    provider: AIProviderAdminSettings,
    options?: { clearToken?: boolean },
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(
        `/settings/ai-providers/${provider.providerKey}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...provider,
            token: options?.clearToken
              ? ""
              : tokenDrafts[provider.providerKey] || "",
            clearToken: options?.clearToken || false,
          }),
        },
      );
      if (!response.ok)
        throw await parseApiError(
          response,
          "AI-Provider konnte nicht gespeichert werden.",
        );
      setProviders(await loadProviders());
      setTokenDrafts((current) => {
        const next = { ...current };
        delete next[provider.providerKey];
        return next;
      });
      setStatus("AI-Provider gespeichert.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI-Provider konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async () => {
    if (!providerToDelete) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(
        `/settings/ai-providers/${providerToDelete.providerKey}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw await parseApiError(
          response,
          "AI-Provider konnte nicht gelöscht werden.",
        );
      setProviders((current) =>
        current.filter(
          (provider) => provider.providerKey !== providerToDelete.providerKey,
        ),
      );
      setProviderToDelete(null);
      setStatus("AI-Provider gelöscht.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI-Provider konnte nicht gelöscht werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (providerKey: string) => {
    setTestingProvider(providerKey);
    setError(null);
    setStatus(null);
    try {
      const response = await fetchApi(
        `/settings/ai-providers/${providerKey}/test`,
        { method: "POST" },
      );
      if (!response.ok)
        throw await parseApiError(
          response,
          "AI-Provider konnte nicht getestet werden.",
        );
      const data = (await response.json()) as { ok: boolean; message?: string };
      setStatus(
        data.ok
          ? "AI-Provider erreichbar."
          : data.message || "AI-Provider-Test fehlgeschlagen.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI-Provider konnte nicht getestet werden.",
      );
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
      setError(err instanceof Error ? err.message : "Suchindex konnte nicht aufgebaut werden.");
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return <p role="status" className="py-10 text-center text-sm text-muted-foreground">AI-Provider werden geladen …</p>;
  }

  const typeItems = AI_PROVIDER_TYPES.map((type) => ({ value: type, label: aiProviderTypeLabel(type) }));
  const mono = "font-mono text-sm";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Bot className="size-5 text-muted-foreground" />
            AI-Provider
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tokens werden verschlüsselt gespeichert und nach dem Speichern nicht mehr angezeigt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={reindexing} onClick={() => void runReindex()}>
            <DatabaseZap />
            Suchindex neu aufbauen
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Provider anlegen
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}
      {status && (
        <Alert variant="plain" tone="success">
          <Alert.Icon />
          <Alert.Title>{status}</Alert.Title>
        </Alert>
      )}

      {providers.length === 0 ? (
        <Alert variant="plain" tone="warning">
          <Alert.Icon />
          <Alert.Title>Es ist aktuell kein AI-Provider konfiguriert.</Alert.Title>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {providers.map((provider) => (
            <Card key={provider.providerKey} className="@container">
              <Card.Header>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Card.Title>{provider.label || provider.providerKey}</Card.Title>
                      {provider.label && <code className="font-mono text-xs text-muted-foreground">{provider.providerKey}</code>}
                      <Badge variant="secondary" size="sm">{aiProviderTypeLabel(provider.providerType)}</Badge>
                      {provider.isDefault && <Badge variant="default" size="sm">Standard</Badge>}
                      {!provider.enabled && <Badge variant="outline" size="sm">Deaktiviert</Badge>}
                    </div>
                    <Card.Description>
                      {provider.tokenConfigured ? "Token gespeichert" : provider.requiresToken ? "Token erforderlich" : "Token optional"} · {provider.chatModel}
                    </Card.Description>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" loading={testingProvider === provider.providerKey} onClick={() => void testProvider(provider.providerKey)}>
                      <Sparkles />
                      Test
                    </Button>
                    <Tooltip>
                      <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${provider.providerKey} löschen`} onClick={() => setProviderToDelete(provider)} />}>
                        <Trash2 />
                      </Tooltip.Trigger>
                      <Tooltip.Content>Provider löschen</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>
              </Card.Header>
              <Card.Content className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
                  <Field>
                    <Field.Label>Bezeichnung</Field.Label>
                    <Input value={provider.label} placeholder="Interner KI-Provider" onChange={(event) => updateProvider(provider.providerKey, { label: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>Base URL</Field.Label>
                    <Input className={mono} value={provider.baseUrl} placeholder="https://api.example.com/v1" onChange={(event) => updateProvider(provider.providerKey, { baseUrl: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>API-Pfad</Field.Label>
                    <Input className={mono} value={provider.apiPath || ""} placeholder="optional" onChange={(event) => updateProvider(provider.providerKey, { apiPath: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>Chat-Modell</Field.Label>
                    <Input className={mono} value={provider.chatModel} placeholder="gpt-4o-mini" onChange={(event) => updateProvider(provider.providerKey, { chatModel: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>API-Version</Field.Label>
                    <Input className={mono} value={provider.apiVersion || ""} placeholder="2024-10-21" onChange={(event) => updateProvider(provider.providerKey, { apiVersion: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>Organisation</Field.Label>
                    <Input className={mono} value={provider.organization || ""} placeholder="optional" onChange={(event) => updateProvider(provider.providerKey, { organization: event.target.value })} />
                  </Field>
                  <Field>
                    <Field.Label>API-Key ersetzen</Field.Label>
                    <Input
                      className={mono}
                      type="password"
                      autoComplete="new-password"
                      value={tokenDrafts[provider.providerKey] || ""}
                      placeholder={provider.tokenConfigured ? "Neuen Key eingeben" : provider.requiresToken ? "API-Key eingeben" : "Optional"}
                      onChange={(event) => setTokenDrafts((current) => ({ ...current, [provider.providerKey]: event.target.value }))}
                    />
                  </Field>
                  <Field>
                    <Field.Label>Temperatur</Field.Label>
                    <Input
                      className={mono}
                      inputMode="decimal"
                      value={temperatureDrafts[provider.providerKey] ?? String(provider.temperature)}
                      placeholder="0.2"
                      onChange={(event) => {
                        const value = event.target.value;
                        setTemperatureDrafts((current) => ({ ...current, [provider.providerKey]: value }));
                        const parsed = Number.parseFloat(value.replace(",", "."));
                        if (!Number.isNaN(parsed)) updateProvider(provider.providerKey, { temperature: parsed });
                      }}
                    />
                    <Field.Description>
                      Bestimmt die Kreativität der Antworten. 0 = sehr deterministisch und faktentreu, 1 = ausgewogen, &gt;1 = experimentell und variabler. Empfohlen: 0.1–0.3 für Wissensfragen.
                    </Field.Description>
                  </Field>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">Aktiv</span>
                      <span className="text-xs text-muted-foreground">Für KI-Funktionen auswählbar</span>
                    </div>
                    <Switch label="Aktiv" checked={provider.enabled} onCheckedChange={(value) => updateProvider(provider.providerKey, { enabled: value })} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">Standard</span>
                      <span className="text-xs text-muted-foreground">Standard für KI-Funktionen</span>
                    </div>
                    <Switch label="Standard" checked={provider.isDefault} onCheckedChange={(value) => updateProvider(provider.providerKey, { isDefault: value })} />
                  </div>
                </div>
              </Card.Content>
              <Card.Footer className="justify-end gap-2">
                <Button variant="ghost" disabled={saving || !provider.tokenConfigured || provider.requiresToken} onClick={() => void saveProvider(provider, { clearToken: true })}>
                  Token löschen
                </Button>
                <Button loading={saving} onClick={() => void saveProvider(provider)}>Provider speichern</Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open && !saving) setCreateOpen(false); }}>
        <Dialog.Content size="lg">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void createProvider();
            }}
          >
            <Dialog.Header title="AI-Provider anlegen" />
            <Dialog.Body className="@container">
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
                <Field>
                  <Field.Label required>Provider-Schlüssel</Field.Label>
                  <Input required className={mono} value={newProvider.providerKey} placeholder="vllm-local" onChange={(event) => setNewProvider((current) => ({ ...current, providerKey: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>Provider-Typ</Field.Label>
                  <Select
                    items={typeItems}
                    value={newProvider.providerType}
                    onValueChange={(key) => {
                      const providerType = String(key) as AIProviderType;
                      setNewProvider((current) => ({
                        ...current,
                        providerType,
                        baseUrl: defaultAIBaseUrl(providerType),
                        chatModel: defaultAIModel(providerType),
                      }));
                    }}
                  >
                    <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                    <Select.Content>{typeItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                  </Select>
                </Field>
                <Field>
                  <Field.Label>Bezeichnung</Field.Label>
                  <Input value={newProvider.label} placeholder="Lokales vLLM" onChange={(event) => setNewProvider((current) => ({ ...current, label: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>Base URL</Field.Label>
                  <Input className={mono} value={newProvider.baseUrl} placeholder="http://localhost:8000/v1" onChange={(event) => setNewProvider((current) => ({ ...current, baseUrl: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label required>Chat-Modell</Field.Label>
                  <Input required className={mono} value={newProvider.chatModel} placeholder="local-model" onChange={(event) => setNewProvider((current) => ({ ...current, chatModel: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>API-Key</Field.Label>
                  <Input className={mono} type="password" autoComplete="new-password" value={newProvider.token} placeholder="Optional für lokale Provider" onChange={(event) => setNewProvider((current) => ({ ...current, token: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>API-Version</Field.Label>
                  <Input className={mono} value={newProvider.apiVersion} placeholder="optional" onChange={(event) => setNewProvider((current) => ({ ...current, apiVersion: event.target.value }))} />
                </Field>
                <Field>
                  <Field.Label>Organisation</Field.Label>
                  <Input className={mono} value={newProvider.organization} placeholder="optional" onChange={(event) => setNewProvider((current) => ({ ...current, organization: event.target.value }))} />
                </Field>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setCreateOpen(false)}>Abbrechen</Button>
              <Button type="submit" loading={saving} disabled={!newProvider.providerKey.trim() || !newProvider.chatModel.trim()}>
                <Plus />
                Provider anlegen
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      <ConfirmDialog
        isOpen={providerToDelete !== null}
        onOpenChange={(open) => { if (!open) setProviderToDelete(null); }}
        title="AI-Provider löschen?"
        description={`„${providerToDelete?.providerKey ?? ""}“ wird dauerhaft gelöscht.`}
        confirmLabel="Löschen"
        isDanger
        isLoading={saving}
        onConfirm={deleteProvider}
      />
    </div>
  );
}
