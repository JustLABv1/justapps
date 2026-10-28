"use client";
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  toast,
  Surface,
} from "@heroui/react";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";

type Policy = { mode: string; providerKey: string; groupName: string };
type Provider = {
  key: string;
  label: string;
  configured: boolean;
  groupsClaim?: string;
};
const modes = [
  {
    key: "everyone",
    label: "Spaces-Erstellung für alle",
    description: "Alle angemeldeten Nutzer dürfen Spaces erstellen.",
  },
  {
    key: "oidc_group",
    label: "Nur für eine OIDC-Gruppe",
    description:
      "Die Mitgliedschaft wird anhand der letzten verifizierten OIDC-Anmeldung geprüft.",
  },
  {
    key: "admins",
    label: "Nur für Administratoren",
    description:
      "Benutzerfreigaben und OIDC-Gruppen erlauben in diesem Modus keine Erstellung.",
  },
  {
    key: "allowed_users",
    label: "Nur für freigegebene Nutzer oder Rollen",
    description:
      "Eine individuelle Freigabe „Spaces erstellen erlauben“ oder das Rollenrecht „Spaces erstellen“ ist erforderlich.",
  },
];
async function request(path: string, body?: unknown) {
  const response = await fetchApi(path, {
    method: body === undefined ? "GET" : "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || "Regel konnte nicht gespeichert werden.");
  return data;
}
export function SpaceCreationPolicyPanel() {
  const [policy, setPolicy] = useState<Policy>({
    mode: "allowed_users",
    providerKey: "",
    groupName: "",
  });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      request("/admin/space-creation-policy"),
      request("/auth/oidc/providers"),
    ])
      .then(([loaded, available]) => {
        if (active) {
          setPolicy(loaded);
          setReady(true);
          setProviders(
            (available as Provider[]).filter((provider) => provider.configured),
          );
        }
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
  }, []);
  return (
    <Surface className="p-6 border border-border/50 shadow-sm">
      <div className="mb-5">
        <h3 className="font-bold text-sm text-muted uppercase tracking-wider mb-5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" /> Spaces-Erstellung
        </h3>
        <p className="mt-1 text-sm text-muted">
          Die globale Regel steuert die Erstellung. Bestehende Spaces und
          Mitgliedschaften bleiben erhalten.
        </p>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-muted">
          Regel wird geladen …
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            void request("/admin/space-creation-policy", policy)
              .then((data) => {
                setPolicy(data);
                toast.success("Globale Space-Regel gespeichert.");
              })
              .catch((err: Error) => setError(err.message))
              .finally(() => setSaving(false));
          }}
        >
          <Select
            value={policy.mode}
            onChange={(value) => setPolicy({ ...policy, mode: String(value) })}
            className="max-w-xl"
          >
            <Label>Globale Erstellungsregel</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {modes.map((mode) => (
                  <ListBox.Item
                    key={mode.key}
                    id={mode.key}
                    textValue={mode.label}
                  >
                    {mode.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <p className="text-sm text-muted">
            {modes.find((mode) => mode.key === policy.mode)?.description}
          </p>
          {policy.mode === "oidc_group" && (
            <>
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <Select
                  value={policy.providerKey || null}
                  onChange={(value) =>
                    setPolicy({ ...policy, providerKey: String(value) })
                  }
                  isRequired
                >
                  <Label>OIDC-Provider</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {providers.map((provider) => (
                        <ListBox.Item
                          key={provider.key}
                          id={provider.key}
                          textValue={provider.label}
                        >
                          {provider.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField
                  isRequired
                  value={policy.groupName}
                  onChange={(value) =>
                    setPolicy({ ...policy, groupName: value })
                  }
                >
                  <Label>Exakter Gruppenname oder Pfad</Label>
                  <Input placeholder="/teams/space-creators" maxLength={512} />
                </TextField>
              </div>
              <p className="text-xs text-muted">
                Gruppen-Claim-Pfad:{" "}
                <code>
                  {providers.find(
                    (provider) => provider.key === policy.providerKey,
                  )?.groupsClaim || "groups"}
                </code>
                . Änderungen der Gruppenzugehörigkeit werden bei der nächsten
                OIDC-Anmeldung wirksam.
              </p>
              {!providers.length && (
                <p className="text-sm text-warning">
                  Zuerst einen aktiven OIDC-Provider einrichten.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted">
              Administratoren dürfen in allen Modi Spaces erstellen.
            </p>
            <Button
              type="submit"
              isPending={saving}
              isDisabled={
                !ready ||
                (policy.mode === "oidc_group" &&
                  (!policy.providerKey || !policy.groupName.trim()))
              }
            >
              Speichern
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </Surface>
  );
}
