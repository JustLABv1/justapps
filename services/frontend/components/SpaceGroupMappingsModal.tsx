"use client";

import {
  Button,
  Dropdown,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { ChevronDown, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open);
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent">
              <ShieldCheck className="h-5 w-5" />
            </Modal.Icon>
            <Modal.Heading>Gruppenzugriff</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-5">
            <p className="text-sm leading-relaxed text-muted">
              Mitglieder der zugeordneten OIDC-Gruppen erhalten beim Anmelden
              automatisch Zugriff auf{" "}
              <strong className="text-foreground">{space.name}</strong>. Eine
              Einladung ist dafür nicht erforderlich.
            </p>
            {loading ? (
              <p role="status" className="py-6 text-sm text-muted">
                Gruppenzuordnungen werden geladen …
              </p>
            ) : (
              <>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {mappings.length ? (
                    mappings.map((mapping) => (
                      <div
                        key={mapping.id}
                        className="flex items-center gap-3 p-4"
                      >
                        <ShieldCheck className="h-4 w-4 shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <p className="break-all text-sm font-medium">
                            {mapping.groupName}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted">
                            {providers.find(
                              (provider) =>
                                provider.key === mapping.providerKey,
                            )?.label || mapping.providerKey}{" "}
                            · {mapping.issuer}
                          </p>
                        </div>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-label={`Zuordnung ${mapping.groupName} entfernen`}
                          isDisabled={saving}
                          onPress={() =>
                            void mutate(async () => {
                              await request(
                                `/spaces/${space.id}/group-mappings/${mapping.id}`,
                                "DELETE",
                              );
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="p-5 text-sm text-muted">
                      Noch keine Gruppen zugeordnet. Manuelle Einladungen
                      funktionieren weiterhin.
                    </p>
                  )}
                </div>
                {providers.length ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(async () => {
                        await request(
                          `/spaces/${space.id}/group-mappings`,
                          "POST",
                          { providerKey, groupName },
                        );
                        setGroupName("");
                      });
                    }}
                  >
                    <div className="grid items-end gap-3 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)_auto]">
                      <div className="space-y-2">
                        <Label>OIDC-Provider</Label>
                        <Dropdown>
                          <Button
                            variant="secondary"
                            className="w-full justify-between"
                            isDisabled={saving}
                            aria-label="OIDC-Provider auswählen"
                          >
                            {providers.find(
                              (provider) => provider.key === providerKey,
                            )?.label || "Provider wählen"}
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Dropdown.Popover>
                            <Dropdown.Menu
                              aria-label="OIDC-Provider"
                              onAction={(key) => setProviderKey(String(key))}
                            >
                              {providers.map((provider) => (
                                <Dropdown.Item
                                  key={provider.key}
                                  id={provider.key}
                                  textValue={provider.label}
                                >
                                  <Label>{provider.label}</Label>
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      </div>
                      <TextField
                        isRequired
                        value={groupName}
                        onChange={setGroupName}
                      >
                        <Label>Exakter Gruppenname oder Pfad</Label>
                        <Input
                          placeholder="/teams/digitalisierung"
                          maxLength={512}
                        />
                      </TextField>
                      <Button
                        type="submit"
                        variant="primary"
                        isPending={saving}
                        isDisabled={!providerKey || !groupName.trim()}
                      >
                        <Plus className="h-4 w-4" />
                        Zuordnen
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted">
                      Verwendeter Claim-Pfad im ID-Token:{" "}
                      <code>
                        {providers.find(
                          (provider) => provider.key === providerKey,
                        )?.groupsClaim || "groups"}
                      </code>
                      . Er wird am OIDC-Provider konfiguriert. Der Gruppenname
                      beziehungsweise Gruppenpfad muss exakt dem Wert in dieser
                      Liste entsprechen.
                    </p>
                  </form>
                ) : (
                  <p className="text-sm text-muted">
                    Zuerst muss in der Verwaltung ein aktiver OIDC-Provider
                    eingerichtet werden.
                  </p>
                )}
                <p className="rounded-xl bg-surface-secondary p-4 text-xs leading-relaxed text-muted">
                  Gruppenänderungen werden bei der nächsten OIDC-Anmeldung des
                  Nutzers synchronisiert. Das Entfernen einer Zuordnung entzieht
                  den darüber erteilten Zugriff sofort. Andere Gruppenzugriffe
                  und manuelle Berechtigungen bleiben bestehen.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              isDisabled={saving}
              onPress={() => onOpenChange(false)}
            >
              Fertig
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
