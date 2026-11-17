"use client";

import { OIDCProviderAdminSettings } from "@/config/apps";
import { fetchApi } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { Textarea } from "@/components/panelui/textarea";
import { Tooltip } from "@/components/panelui/tooltip";
import { ChevronDown, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type OIDCProviderDraft = {
  providerKey: string;
  label: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  adminGroup: string;
  groupsClaim: string;
  enabled: boolean;
  insecure: boolean;
  disableLocalAuth: boolean;
  scopesText: string;
};

const defaultProviderDraft = (): OIDCProviderDraft => ({
  providerKey: "",
  label: "",
  issuer: "",
  clientId: "",
  clientSecret: "",
  adminGroup: "admin",
  groupsClaim: "groups",
  enabled: true,
  insecure: false,
  disableLocalAuth: false,
  scopesText: "openid\nprofile\nemail",
});

function normalizeScopes(scopesText: string): string[] {
  return scopesText
    .split(/\n|,/)
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);
}

function scopesToText(scopes: string[]): string {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return "openid\nprofile\nemail";
  }

  return scopes.join("\n");
}

type ProviderFieldValues = {
  label: string;
  issuer: string;
  clientId: string;
  groupsClaim: string;
  adminGroup: string;
  secret: string;
  scopesText: string;
  enabled: boolean;
  insecure: boolean;
  disableLocalAuth: boolean;
};

const mono = "font-mono text-sm";

function SettingRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <Switch label={title} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** The fields an OIDC provider has, shared by the editor of an existing provider and the dialog that creates one. */
function ProviderFields({
  values,
  onChange,
  secretLabel,
  secretPlaceholder,
  secretStatus,
  explain,
}: {
  values: ProviderFieldValues;
  onChange: (patch: Partial<ProviderFieldValues>) => void;
  secretLabel: string;
  secretPlaceholder: string;
  secretStatus?: React.ReactNode;
  explain: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
      <Field>
        <Field.Label>Bezeichnung</Field.Label>
        <Input value={values.label} placeholder="z. B. Landes-SSO" onChange={(event) => onChange({ label: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Issuer URL</Field.Label>
        <Input className={mono} value={values.issuer} placeholder="https://id.example.org/realms/main" onChange={(event) => onChange({ issuer: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Client ID</Field.Label>
        <Input className={mono} value={values.clientId} placeholder="justapps-web" onChange={(event) => onChange({ clientId: event.target.value })} />
      </Field>
      <Field>
        <Field.Label>Client Secret{secretLabel}</Field.Label>
        <Input
          className={mono}
          type="password"
          autoComplete="new-password"
          value={values.secret}
          placeholder={secretPlaceholder}
          onChange={(event) => onChange({ secret: event.target.value })}
        />
        {secretStatus}
      </Field>
      <Field>
        <Field.Label>Gruppen-Claim-Pfad</Field.Label>
        <Input className={mono} maxLength={512} value={values.groupsClaim} placeholder="groups" onChange={(event) => onChange({ groupsClaim: event.target.value })} />
        <Field.Description>
          {explain
            ? "Zum Beispiel groups, realm.groups oder /organization/acme/groups. Der Claim muss eine Liste von Gruppennamen enthalten."
            : "groups, realm.groups oder ein JSON Pointer wie /organization/acme/groups."}
        </Field.Description>
      </Field>
      <Field>
        <Field.Label>Admin-Gruppe / Rolle</Field.Label>
        <Input className={mono} value={values.adminGroup} placeholder="admin" onChange={(event) => onChange({ adminGroup: event.target.value })} />
      </Field>
      <Field className="@lg:col-span-2">
        <Field.Label>Scopes</Field.Label>
        <Textarea className={mono} rows={4} value={values.scopesText} placeholder={"openid\nprofile\nemail"} onChange={(event) => onChange({ scopesText: event.target.value })} />
        <Field.Description>Ein Scope pro Zeile.</Field.Description>
      </Field>
      <SettingRow title="Provider aktiv" description="Steuert, ob dieser Provider auf der Login-Seite erscheint." checked={values.enabled} onChange={(enabled) => onChange({ enabled })} />
      <SettingRow title="TLS-Prüfung deaktivieren" description="Nur für Entwicklungs- und Testumgebungen mit selbstsignierten Zertifikaten." checked={values.insecure} onChange={(insecure) => onChange({ insecure })} />
      <div className="@lg:col-span-2">
        <SettingRow
          title="Lokale Anmeldung deaktivieren"
          description="Blendet die Anmeldung mit E-Mail und Passwort auf der Login-Seite aus, sobald mindestens ein Provider das vorgibt."
          checked={values.disableLocalAuth}
          onChange={(disableLocalAuth) => onChange({ disableLocalAuth })}
        />
      </div>
    </div>
  );
}

export function OIDCProviderSettingsPanel() {
  const [providers, setProviders] = useState<OIDCProviderAdminSettings[]>([]);
  const [providerSecretDrafts, setProviderSecretDrafts] = useState<
    Record<string, string>
  >({});
  const [expandedProviders, setExpandedProviders] = useState<
    Record<string, boolean>
  >({});
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] =
    useState<OIDCProviderDraft>(defaultProviderDraft);
  const [providerToDelete, setProviderToDelete] =
    useState<OIDCProviderAdminSettings | null>(null);

  const loadProviders = async () => {
    const response = await fetchApi("/settings/oidc-providers");
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string }).message ||
          "OIDC-Provider konnten nicht geladen werden.",
      );
    }

    const data = (await response.json()) as OIDCProviderAdminSettings[];
    const normalized = Array.isArray(data)
      ? data.map((provider) => ({
          ...provider,
          scopes:
            Array.isArray(provider.scopes) && provider.scopes.length > 0
              ? provider.scopes
              : ["openid", "profile", "email"],
        }))
      : [];
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
        const response = await fetchApi("/settings/oidc-providers");
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            (body as { message?: string }).message ||
              "OIDC-Provider konnten nicht geladen werden.",
          );
        }

        const data = (await response.json()) as OIDCProviderAdminSettings[];
        const normalized = Array.isArray(data)
          ? data.map((provider) => ({
              ...provider,
              scopes:
                Array.isArray(provider.scopes) && provider.scopes.length > 0
                  ? provider.scopes
                  : ["openid", "profile", "email"],
            }))
          : [];

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
          setError(
            err instanceof Error
              ? err.message
              : "OIDC-Provider konnten nicht geladen werden.",
          );
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

  const updateProvider = (
    providerKey: string,
    patch: Partial<OIDCProviderAdminSettings>,
  ) => {
    setProviders((prev) =>
      prev.map((provider) =>
        provider.providerKey === providerKey
          ? { ...provider, ...patch }
          : provider,
      ),
    );
  };

  const saveProvider = async (
    provider: OIDCProviderAdminSettings,
    options?: { clearSecret?: boolean },
  ) => {
    setSaving(true);
    setError(null);

    try {
      const secretDraft =
        providerSecretDrafts[provider.providerKey]?.trim() || "";
      const response = await fetchApi(
        `/settings/oidc-providers/${provider.providerKey}`,
        {
          method: "PUT",
          body: JSON.stringify({
            label: provider.label,
            issuer: provider.issuer,
            clientId: provider.clientId,
            clientSecret: options?.clearSecret ? "" : secretDraft,
            clearSecret: options?.clearSecret ?? false,
            adminGroup: provider.adminGroup,
            groupsClaim: provider.groupsClaim || "groups",
            enabled: provider.enabled,
            insecure: provider.insecure,
            disableLocalAuth: provider.disableLocalAuth,
            scopes: normalizeScopes(
              scopeDrafts[provider.providerKey] ?? scopesToText(provider.scopes),
            ),
          }),
        },
      );

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (body as { message?: string }).message ||
            "OIDC-Provider konnte nicht gespeichert werden.",
        );
      }

      await loadProviders();
      setProviderSecretDrafts((prev) => {
        const next = { ...prev };
        delete next[provider.providerKey];
        return next;
      });
      setScopeDrafts((prev) => {
        const next = { ...prev };
        delete next[provider.providerKey];
        return next;
      });
      setSavedKey(provider.providerKey);
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OIDC-Provider konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createProvider = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetchApi("/settings/oidc-providers", {
        method: "POST",
        body: JSON.stringify({
          providerKey: createDraft.providerKey.trim(),
          label: createDraft.label,
          issuer: createDraft.issuer.trim(),
          clientId: createDraft.clientId.trim(),
          clientSecret: createDraft.clientSecret,
          adminGroup: createDraft.adminGroup,
          groupsClaim: createDraft.groupsClaim,
          enabled: createDraft.enabled,
          insecure: createDraft.insecure,
          disableLocalAuth: createDraft.disableLocalAuth,
          scopes: normalizeScopes(createDraft.scopesText),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (body as { message?: string }).message ||
            "OIDC-Provider konnte nicht erstellt werden.",
        );
      }

      await loadProviders();
      setCreateDraft(defaultProviderDraft());
      setCreateModalOpen(false);
      setSavedKey("create");
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OIDC-Provider konnte nicht erstellt werden.",
      );
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
      const response = await fetchApi(
        `/settings/oidc-providers/${providerToDelete.providerKey}`,
        {
          method: "DELETE",
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (body as { message?: string }).message ||
            "OIDC-Provider konnte nicht gelöscht werden.",
        );
      }

      await loadProviders();
      setProviderToDelete(null);
      setSavedKey("delete");
      window.setTimeout(() => setSavedKey(null), 1800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "OIDC-Provider konnte nicht gelöscht werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p role="status" className="py-10 text-center text-sm text-muted-foreground">OIDC-Provider werden geladen …</p>;
  }

  const closeCreate = () => {
    setCreateModalOpen(false);
    setCreateDraft(defaultProviderDraft());
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-muted-foreground" />
            Anmeldung &amp; SSO
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Verwalten Sie mehrere OIDC-Provider zentral. Client-Secrets werden verschlüsselt gespeichert und nach dem Speichern nicht angezeigt. Die Login-Seite zeigt alle aktiven Provider an.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateModalOpen(true)}>
          <Plus />
          {savedKey === "create" ? "Provider erstellt ✓" : "Neuer Provider"}
        </Button>
      </div>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      {providers.length === 0 ? (
        <Alert variant="plain" tone="warning">
          <Alert.Icon />
          <Alert.Title>Es sind aktuell keine OIDC-Provider konfiguriert.</Alert.Title>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {providers.map((provider) => {
            const expanded = expandedProviders[provider.providerKey] ?? false;
            const panelId = `oidc-${provider.providerKey}`;
            return (
              <Card key={provider.providerKey} className="gap-0 py-0">
                <div className="flex items-center gap-2 p-3 sm:p-4">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setExpandedProviders((prev) => ({ ...prev, [provider.providerKey]: !expanded }))}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-1.5 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{provider.label || provider.providerKey}</span>
                        {provider.label && <code className="font-mono text-xs text-muted-foreground">{provider.providerKey}</code>}
                        <Badge variant={provider.enabled ? "success" : "secondary"} size="sm">{provider.enabled ? "Aktiv" : "Deaktiviert"}</Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {provider.secretConfigured ? "Client-Secret verschlüsselt gespeichert" : "Kein Secret gespeichert"}
                        {provider.configured ? " · Vollständig konfiguriert" : " · Konfiguration unvollständig"}
                      </span>
                    </span>
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  <Tooltip>
                    <Tooltip.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${provider.providerKey} löschen`} disabled={saving} onClick={() => setProviderToDelete(provider)} />}>
                      <Trash2 />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Provider löschen</Tooltip.Content>
                  </Tooltip>
                </div>

                {expanded && (
                  <div id={panelId} className="@container flex flex-col gap-5 border-t p-4 sm:p-5">
                    <ProviderFields
                      explain
                      values={{
                        label: provider.label,
                        issuer: provider.issuer,
                        clientId: provider.clientId,
                        groupsClaim: provider.groupsClaim || "groups",
                        adminGroup: provider.adminGroup,
                        secret: providerSecretDrafts[provider.providerKey] || "",
                        scopesText: scopeDrafts[provider.providerKey] ?? scopesToText(provider.scopes),
                        enabled: provider.enabled,
                        insecure: provider.insecure,
                        disableLocalAuth: provider.disableLocalAuth,
                      }}
                      onChange={(patch) => {
                        const { secret, scopesText, ...rest } = patch;
                        if (secret !== undefined) setProviderSecretDrafts((prev) => ({ ...prev, [provider.providerKey]: secret }));
                        if (scopesText !== undefined) setScopeDrafts((prev) => ({ ...prev, [provider.providerKey]: scopesText }));
                        if (Object.keys(rest).length) updateProvider(provider.providerKey, rest);
                      }}
                      secretLabel=" ersetzen"
                      secretPlaceholder={provider.secretConfigured ? "Neues Secret eingeben, um das bestehende zu ersetzen" : "Secret eingeben"}
                      secretStatus={
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${provider.secretConfigured ? "bg-success" : "bg-warning"}`} />
                            {provider.secretConfigured ? "Secret hinterlegt" : "Kein Secret hinterlegt – Anmeldung nicht möglich"}
                          </p>
                          {provider.secretConfigured && (
                            <Button type="button" size="sm" variant="ghost" aria-label="Client Secret löschen" disabled={saving} onClick={() => void saveProvider(provider, { clearSecret: true })}>
                              Secret löschen
                            </Button>
                          )}
                        </div>
                      }
                    />
                    <div className="flex justify-end border-t pt-4">
                      <Button loading={saving} onClick={() => void saveProvider(provider)}>
                        {savedKey === provider.providerKey ? "Gespeichert ✓" : "Provider speichern"}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={(open) => { if (!open && !saving) closeCreate(); }}>
        <Dialog.Content size="lg">
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              void createProvider();
            }}
          >
            <Dialog.Header title="Neuen OIDC-Provider anlegen" description="Provider-Schlüssel, Issuer, Client-ID und Secret werden für den OIDC-Login benötigt." />
            <Dialog.Body className="@container flex flex-col gap-4">
              <Field>
                <Field.Label required>Provider-Schlüssel</Field.Label>
                <Input required className={mono} value={createDraft.providerKey} placeholder="z. B. keycloak-main" onChange={(event) => setCreateDraft((prev) => ({ ...prev, providerKey: event.target.value }))} />
              </Field>
              <ProviderFields
                explain={false}
                values={{ ...createDraft, secret: createDraft.clientSecret }}
                onChange={(patch) => {
                  const { secret, ...rest } = patch;
                  setCreateDraft((prev) => ({ ...prev, ...rest, ...(secret !== undefined ? { clientSecret: secret } : {}) }));
                }}
                secretLabel=""
                secretPlaceholder="Secret eingeben"
              />
            </Dialog.Body>
            <Dialog.Footer>
              <Button type="button" variant="secondary" disabled={saving} onClick={closeCreate}>Abbrechen</Button>
              <Button type="submit" loading={saving} disabled={!createDraft.providerKey.trim()}>Provider erstellen</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      <ConfirmDialog
        isOpen={providerToDelete !== null}
        onOpenChange={(open) => { if (!open) setProviderToDelete(null); }}
        title="OIDC-Provider löschen?"
        description={`Soll „${providerToDelete?.providerKey ?? ""}“ wirklich gelöscht werden? Wer sich darüber anmeldet, kann das danach nicht mehr.`}
        confirmLabel="Löschen"
        isDanger
        isLoading={saving}
        onConfirm={deleteProvider}
      />
    </div>
  );
}
