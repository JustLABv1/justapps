"use client";

import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Select } from "@/components/panelui/select";
import { Tooltip } from "@/components/panelui/tooltip";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Mapping = {
  id: string;
  providerKey: string;
  issuer: string;
  groupName: string;
};
type Provider = {
  key: string;
  label: string;
  issuer: string;
  configured: boolean;
  groupsClaim?: string;
};
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetchApi(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || "Gruppenzuordnung konnte nicht gespeichert werden.",
    );
  }
  return response.status === 204 ? null : response.json();
}

export function SpaceGroupMappingsModal({
  space,
  onOpenChange,
}: {
  space: { id: string; name: string };
  onOpenChange: (open: boolean) => void;
}) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [providerKey, setProviderKey] = useState("");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      request("/auth/oidc/providers"),
      request(`/spaces/${space.id}/group-mappings`),
    ])
      .then(([available, configured]) => {
        if (!active) return;
        const list = (available as Provider[]).filter(
          (provider) => provider.configured,
        );
        setProviders(list);
        setProviderKey(list[0]?.key || "");
        setMappings(configured);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [space.id]);
  const mutate = async (action: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await action();
      setMappings(await request(`/spaces/${space.id}/group-mappings`));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  };
  const providerItems = providers.map((provider) => ({ value: provider.key, label: provider.label }));
  const claim = providers.find((provider) => provider.key === providerKey)?.groupsClaim || "groups";

  return (
    <Dialog open onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <Dialog.Content size="lg">
        <Dialog.Header
          title="Gruppenzugriff"
          description={<>Mitglieder der zugeordneten OIDC-Gruppen bekommen bei der Anmeldung automatisch Zugriff auf <strong className="font-medium text-foreground">{space.name}</strong>, ohne Einladung.</>}
        />
        <Dialog.Body className="flex flex-col gap-4">
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
          {loading ? (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">Gruppenzuordnungen werden geladen …</p>
          ) : (
            <>
              <ul className="divide-y overflow-hidden rounded-xl border">
                {mappings.length ? (
                  mappings.map((mapping) => (
                    <li key={mapping.id} className="flex items-center gap-3 px-4 py-3">
                      <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="break-all text-sm font-medium">{mapping.groupName}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {providers.find((provider) => provider.key === mapping.providerKey)?.label || mapping.providerKey} · {mapping.issuer}
                        </span>
                      </span>
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              aria-label={`Zuordnung ${mapping.groupName} entfernen`}
                              onClick={() => void mutate(async () => { await request(`/spaces/${space.id}/group-mappings/${mapping.id}`, "DELETE"); })}
                            />
                          }
                        >
                          <Trash2 />
                        </Tooltip.Trigger>
                        <Tooltip.Content>Zuordnung entfernen</Tooltip.Content>
                      </Tooltip>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-5 text-sm text-muted-foreground">Noch keine Gruppe zugeordnet. Einladungen funktionieren weiterhin.</li>
                )}
              </ul>
              {providers.length ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void mutate(async () => {
                      await request(`/spaces/${space.id}/group-mappings`, "POST", { providerKey, groupName });
                      setGroupName("");
                    });
                  }}
                >
                  <div className="grid items-end gap-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
                    <Field>
                      <Field.Label>OIDC-Provider</Field.Label>
                      <Select items={providerItems} value={providerKey} onValueChange={(value) => setProviderKey(String(value ?? ""))}>
                        <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                        <Select.Content>{providerItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                      </Select>
                    </Field>
                    <Field>
                      <Field.Label required>Gruppenname oder Pfad</Field.Label>
                      <Input required value={groupName} maxLength={512} placeholder="/teams/digitalisierung" onChange={(event) => setGroupName(event.target.value)} />
                    </Field>
                    <Button type="submit" loading={saving} disabled={!providerKey || !groupName.trim()}>
                      <Plus />
                      Zuordnen
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Der Name muss exakt dem Eintrag im Claim <code className="font-mono">{claim}</code> des ID-Tokens entsprechen.
                  </p>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Zuerst muss ein aktiver OIDC-Provider eingerichtet sein.</p>
              )}
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                Gruppenänderungen gelten ab der nächsten Anmeldung der Person. Eine entfernte Zuordnung entzieht den Zugriff darüber sofort; andere Zugriffe bleiben bestehen.
              </p>
            </>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Fertig</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
