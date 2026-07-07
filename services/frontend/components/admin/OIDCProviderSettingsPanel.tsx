'use client';

import { OIDCProviderAdminSettings } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { Button, Disclosure, Input, Label, Modal, Surface, Switch, TextField, Tooltip } from '@heroui/react';
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { ClipboardEvent, useEffect, useState } from 'react';

type OIDCProviderDraft = {
  providerKey: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  adminGroup: string;
  enabled: boolean;
  insecure: boolean;
  disableLocalAuth: boolean;
  scopesText: string;
};

const defaultProviderDraft = (): OIDCProviderDraft => ({
  providerKey: '',
  label: '',
  issuer: '',
  clientId: '',
  clientSecret: '',
  adminGroup: 'admin',
  enabled: true,
  insecure: false,
  disableLocalAuth: false,
  scopesText: 'openid\nprofile\nemail',
});

function normalizeScopes(scopesText: string): string[] {
  return scopesText
    .split(/\n|,/) 
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
}

function scopesToText(scopes: string[]): string {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return 'openid\nprofile\nemail';
  }

  return scopes.join('\n');
}

function readClipboardFromPasteEvent(event: ClipboardEvent<HTMLInputElement>): string {
  return event.clipboardData.getData('text');
}

export function OIDCProviderSettingsPanel() {
  const [providers, setProviders] = useState<OIDCProviderAdminSettings[]>([]);
  const [providerSecretDrafts, setProviderSecretDrafts] = useState<Record<string, string>>({});
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<OIDCProviderDraft>(defaultProviderDraft);
  const [providerToDelete, setProviderToDelete] = useState<OIDCProviderAdminSettings | null>(null);

  const loadProviders = async () => {
    const response = await fetchApi('/settings/oidc-providers');
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message || 'OIDC-Provider konnten nicht geladen werden.');
    }

    const data = await response.json() as OIDCProviderAdminSettings[];
    const normalized = Array.isArray(data) ? data.map((provider) => ({
      ...provider,
      scopes: Array.isArray(provider.scopes) && provider.scopes.length > 0 ? provider.scopes : ['openid', 'profile', 'email'],
    })) : [];
    setProviders(normalized);
    setExpandedProviders((prev) => {
      const next: Record<string, boolean> = {};
      for (const provider of normalized) {
        next[provider.providerKey] = prev[provider.providerKey] ?? false;
      }

      if (normalized.length > 0 && !Object.values(next).some(Boolean)) {
        next[normalized[0].providerKey] = true;
      }

      return next;
    });
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetchApi('/settings/oidc-providers');
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || 'OIDC-Provider konnten nicht geladen werden.');
        }

        const data = await response.json() as OIDCProviderAdminSettings[];
        const normalized = Array.isArray(data) ? data.map((provider) => ({
          ...provider,
          scopes: Array.isArray(provider.scopes) && provider.scopes.length > 0 ? provider.scopes : ['openid', 'profile', 'email'],
        })) : [];

        if (!active) {
          return;
        }

        setProviders(normalized);
        setExpandedProviders((prev) => {
          const next: Record<string, boolean> = {};
          for (const provider of normalized) {
            next[provider.providerKey] = prev[provider.providerKey] ?? false;
          }

          if (normalized.length > 0 && !Object.values(next).some(Boolean)) {
            next[normalized[0].providerKey] = true;
          }

          return next;
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'OIDC-Provider konnten nicht geladen werden.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateProvider = (providerKey: string, patch: Partial<OIDCProviderAdminSettings>) => {
    setProviders((prev) => prev.map((provider) => (
      provider.providerKey === providerKey ? { ...provider, ...patch } : provider
    )));
  };

  const pasteFromClipboard = async (onPaste: (value: string) => void) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      setError('Zwischenablage-Zugriff wird von diesem Browser nicht unterstuetzt.');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        return;
      }
      onPaste(text);
      setError(null);
    } catch {
      setError('Zwischenablage konnte nicht gelesen werden. Bitte Browser-Berechtigung pruefen.');
    }
  };

  const saveProvider = async (provider: OIDCProviderAdminSettings, options?: { clearSecret?: boolean }) => {
    setSaving(true);
    setError(null);

    try {
      const secretDraft = providerSecretDrafts[provider.providerKey]?.trim() || '';
      const response = await fetchApi(`/settings/oidc-providers/${provider.providerKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          label: provider.label,
          issuer: provider.issuer,
          clientId: provider.clientId,
          clientSecret: options?.clearSecret ? '' : secretDraft,
          clearSecret: options?.clearSecret ?? false,
          adminGroup: provider.adminGroup,
          enabled: provider.enabled,
          insecure: provider.insecure,
          disableLocalAuth: provider.disableLocalAuth,
          scopes: provider.scopes,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { message?: string }).message || 'OIDC-Provider konnte nicht gespeichert werden.');
      }

      await loadProviders();
      setProviderSecretDrafts((prev) => {
        const next = { ...prev };
        delete next[provider.providerKey];
        return next;
      });
      setSavedKey(provider.providerKey);
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OIDC-Provider konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const createProvider = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetchApi('/settings/oidc-providers', {
        method: 'POST',
        body: JSON.stringify({
          providerKey: createDraft.providerKey.trim(),
          label: createDraft.label,
          issuer: createDraft.issuer.trim(),
          clientId: createDraft.clientId.trim(),
          clientSecret: createDraft.clientSecret,
          adminGroup: createDraft.adminGroup,
          enabled: createDraft.enabled,
          insecure: createDraft.insecure,
          disableLocalAuth: createDraft.disableLocalAuth,
          scopes: normalizeScopes(createDraft.scopesText),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { message?: string }).message || 'OIDC-Provider konnte nicht erstellt werden.');
      }

      await loadProviders();
      setCreateDraft(defaultProviderDraft());
      setCreateModalOpen(false);
      setSavedKey('create');
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OIDC-Provider konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async () => {
    if (!providerToDelete) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetchApi(`/settings/oidc-providers/${providerToDelete.providerKey}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { message?: string }).message || 'OIDC-Provider konnte nicht gelöscht werden.');
      }

      await loadProviders();
      setProviderToDelete(null);
      setSavedKey('delete');
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OIDC-Provider konnte nicht gelöscht werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Surface className="p-6 border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          OIDC-Provider werden geladen...
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="p-6 border border-border/50 shadow-sm">
      <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-accent" /> OIDC-Provider
      </h3>
      <p className="text-xs text-muted mb-5">
        Verwalten Sie mehrere OIDC-Provider zentral. Client-Secrets werden verschlüsselt gespeichert und nach dem Speichern nicht angezeigt.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-dashed border-border bg-surface-secondary/35 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Neuen OIDC-Provider anlegen</p>
            <p className="mt-1 text-xs text-muted">Definieren Sie Issuer, Client-ID und Secret je Provider. Der Login zeigt anschließend alle aktiven Provider an.</p>
          </div>
          <Button className="bg-accent text-white" onPress={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {savedKey === 'create' ? 'Provider erstellt ✓' : 'Neuen Provider anlegen'}
          </Button>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-warning">
          Es sind aktuell keine OIDC-Provider konfiguriert.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {providers.map((provider) => (
            <Disclosure
              key={provider.providerKey}
              className="rounded-2xl border border-border bg-surface"
              isExpanded={expandedProviders[provider.providerKey] ?? false}
              onExpandedChange={(isExpanded) => {
                setExpandedProviders((prev) => ({ ...prev, [provider.providerKey]: isExpanded }));
              }}
            >
              <Disclosure.Heading className="flex items-start gap-3 p-5">
                <Disclosure.Trigger className="flex flex-1 items-start justify-between rounded-xl border border-border/40 bg-surface-secondary/25 p-3 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{provider.providerKey}</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${provider.enabled ? 'border-success/20 bg-success/10 text-success' : 'border-border bg-surface-secondary text-muted'}`}>
                        {provider.enabled ? 'Aktiv' : 'Deaktiviert'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {provider.secretConfigured ? 'Client-Secret verschlüsselt gespeichert' : 'Kein Secret gespeichert'}
                      {provider.configured ? ' · Vollständig konfiguriert' : ' · Konfiguration unvollständig'}
                    </p>
                  </div>
                  <Disclosure.Indicator className="mt-1 h-4 w-4 text-muted" />
                </Disclosure.Trigger>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0 text-danger"
                        isDisabled={saving}
                        onPress={() => setProviderToDelete(provider)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Provider löschen</Tooltip.Content>
                </Tooltip>
              </Disclosure.Heading>

              <Disclosure.Content>
                <Disclosure.Body className="border-t border-border p-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TextField value={provider.label} onChange={(val) => updateProvider(provider.providerKey, { label: val })}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Bezeichnung</Label>
                  <Input placeholder="z. B. Landes-SSO" className="bg-field-background" />
                </TextField>

                <TextField value={provider.issuer} onChange={(val) => updateProvider(provider.providerKey, { issuer: val })}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Issuer URL</Label>
                  <Input placeholder="https://id.example.org/realms/main" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={provider.clientId} onChange={(val) => updateProvider(provider.providerKey, { clientId: val })}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Client ID</Label>
                  <Input placeholder="justapps-web" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={provider.adminGroup} onChange={(val) => updateProvider(provider.providerKey, { adminGroup: val })}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Admin-Gruppe / Rolle</Label>
                  <Input placeholder="admin" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Client Secret ersetzen</Label>
                  <Input
                    type="password"
                    value={providerSecretDrafts[provider.providerKey] || ''}
                    onChange={(event) => setProviderSecretDrafts((prev) => ({ ...prev, [provider.providerKey]: event.target.value }))}
                    placeholder={provider.secretConfigured ? 'Neues Secret eingeben, um das bestehende zu ersetzen' : 'Secret eingeben'}
                    className="bg-field-background font-mono text-sm"
                    autoComplete="new-password"
                    onPaste={(event) => {
                      const pasted = readClipboardFromPasteEvent(event);
                      if (!pasted) {
                        return;
                      }
                      setProviderSecretDrafts((prev) => ({ ...prev, [provider.providerKey]: pasted }));
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
                        void pasteFromClipboard((value) => {
                          setProviderSecretDrafts((prev) => ({ ...prev, [provider.providerKey]: value }));
                        });
                      }
                    }}
                  />
                </TextField>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex h-full flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Secret-Status</p>
                      <p className="mt-1 text-xs text-muted">Ohne Secret kann der Provider nicht für die Anmeldung genutzt werden.</p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-danger"
                        isDisabled={saving || !provider.secretConfigured}
                        onPress={() => saveProvider(provider, { clearSecret: true })}
                      >
                        Secret löschen
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Scopes</Label>
                  <textarea
                    value={scopesToText(provider.scopes)}
                    onChange={(event) => updateProvider(provider.providerKey, { scopes: normalizeScopes(event.target.value) })}
                    className="min-h-[110px] w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    placeholder={'openid\nprofile\nemail'}
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Provider aktiv</p>
                      <p className="text-xs text-muted">Steuert, ob dieser Provider auf der Login-Seite erscheint.</p>
                    </div>
                    <Switch isSelected={provider.enabled} onChange={(val) => updateProvider(provider.providerKey, { enabled: val })}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">TLS-Prüfung deaktivieren</p>
                      <p className="text-xs text-muted">Nur für Entwicklungs- oder Testumgebungen mit selbstsignierten Zertifikaten.</p>
                    </div>
                    <Switch isSelected={provider.insecure} onChange={(val) => updateProvider(provider.providerKey, { insecure: val })}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Lokale Anmeldung deaktivieren</p>
                      <p className="text-xs text-muted">Wenn aktiv, blendet die Login-Seite die E-Mail/Passwort-Anmeldung aus, sobald mindestens ein Provider das vorgibt.</p>
                    </div>
                    <Switch isSelected={provider.disableLocalAuth} onChange={(val) => updateProvider(provider.providerKey, { disableLocalAuth: val })}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>
                  </div>

                  <div className="mt-5 flex justify-end border-t border-border pt-4">
                    <Button className="bg-accent text-white" isDisabled={saving} onPress={() => saveProvider(provider)}>
                      {savedKey === provider.providerKey ? 'Gespeichert ✓' : 'Provider speichern'}
                    </Button>
                  </div>
                </Disclosure.Body>
              </Disclosure.Content>
            </Disclosure>
          ))}
        </div>
      )}

      <Modal.Backdrop isOpen={createModalOpen} onOpenChange={(open) => { if (!open) { setCreateModalOpen(false); setCreateDraft(defaultProviderDraft()); } }}>
        <Modal.Container>
          <Modal.Dialog className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent/10 text-accent">
                <KeyRound className="w-5 h-5" />
              </Modal.Icon>
              <Modal.Heading>Neuen OIDC-Provider anlegen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">Provider-Schlüssel, Issuer, Client-ID und Secret werden für den OIDC-Login benötigt.</p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <TextField value={createDraft.providerKey} onChange={(val) => setCreateDraft((prev) => ({ ...prev, providerKey: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Provider-Schlüssel</Label>
                  <Input placeholder="z. B. keycloak-main" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={createDraft.label} onChange={(val) => setCreateDraft((prev) => ({ ...prev, label: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Bezeichnung</Label>
                  <Input placeholder="z. B. Behörden-SSO" className="bg-field-background" />
                </TextField>

                <TextField value={createDraft.issuer} onChange={(val) => setCreateDraft((prev) => ({ ...prev, issuer: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Issuer URL</Label>
                  <Input placeholder="https://id.example.org/realms/main" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField value={createDraft.clientId} onChange={(val) => setCreateDraft((prev) => ({ ...prev, clientId: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Client ID</Label>
                  <Input placeholder="justapps-web" className="bg-field-background font-mono text-sm" />
                </TextField>

                <TextField>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Client Secret</Label>
                  <Input
                    type="password"
                    value={createDraft.clientSecret}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, clientSecret: event.target.value }))}
                    placeholder="Secret eingeben"
                    className="bg-field-background font-mono text-sm"
                    autoComplete="new-password"
                    onPaste={(event) => {
                      const pasted = readClipboardFromPasteEvent(event);
                      if (!pasted) {
                        return;
                      }
                      setCreateDraft((prev) => ({ ...prev, clientSecret: pasted }));
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
                        void pasteFromClipboard((value) => {
                          setCreateDraft((prev) => ({ ...prev, clientSecret: value }));
                        });
                      }
                    }}
                  />
                </TextField>

                <TextField value={createDraft.adminGroup} onChange={(val) => setCreateDraft((prev) => ({ ...prev, adminGroup: val }))}>
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Admin-Gruppe / Rolle</Label>
                  <Input placeholder="admin" className="bg-field-background font-mono text-sm" />
                </TextField>

                <div className="lg:col-span-2">
                  <Label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 ml-1">Scopes</Label>
                  <textarea
                    value={createDraft.scopesText}
                    onChange={(event) => setCreateDraft((prev) => ({ ...prev, scopesText: event.target.value }))}
                    className="min-h-[110px] w-full rounded-xl border border-border bg-field-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    placeholder={'openid\nprofile\nemail'}
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-foreground">Provider aktiv</p>
                    <Switch isSelected={createDraft.enabled} onChange={(val) => setCreateDraft((prev) => ({ ...prev, enabled: val }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-foreground">TLS-Prüfung deaktivieren</p>
                    <Switch isSelected={createDraft.insecure} onChange={(val) => setCreateDraft((prev) => ({ ...prev, insecure: val }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-xl border border-border bg-surface-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-foreground">Lokale Anmeldung deaktivieren</p>
                    <Switch isSelected={createDraft.disableLocalAuth} onChange={(val) => setCreateDraft((prev) => ({ ...prev, disableLocalAuth: val }))}>
                      <Switch.Content>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => { setCreateModalOpen(false); setCreateDraft(defaultProviderDraft()); }}>
                Abbrechen
              </Button>
              <Button className="bg-accent text-white" isDisabled={saving} onPress={createProvider}>
                Provider erstellen
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={providerToDelete !== null} onOpenChange={(open) => { if (!open) setProviderToDelete(null); }}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>OIDC-Provider löschen</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm text-muted">
                Soll der OIDC-Provider <strong>{providerToDelete?.providerKey}</strong> wirklich gelöscht werden?
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={() => setProviderToDelete(null)}>Abbrechen</Button>
              <Button className="bg-danger text-white" isDisabled={saving} onPress={deleteProvider}>Löschen</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Surface>
  );
}
