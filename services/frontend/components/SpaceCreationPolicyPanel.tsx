"use client";

import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { RadioGroup } from "@/components/panelui/radio-group";
import { Select } from "@/components/panelui/select";
import { fetchApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";

type Policy = { mode: string; providerKey: string; groupName: string };
type Provider = {
  key: string;
  label: string;
  configured: boolean;
  groupsClaim?: string;
};

const MODES = [
  { key: "everyone", label: "Alle angemeldeten Nutzer", description: "Jedes Konto darf eigene Spaces erstellen." },
  { key: "allowed_users", label: "Freigegebene Nutzer und Rollen", description: "Nur mit der Freigabe „Spaces erstellen“ am Konto oder dem gleichnamigen Rollenrecht." },
  { key: "oidc_group", label: "Eine OIDC-Gruppe", description: "Geprüft wird die Gruppenzugehörigkeit bei der letzten Anmeldung über Single Sign-on." },
  { key: "admins", label: "Nur Administration", description: "Freigaben am Konto und OIDC-Gruppen erlauben dann keine Erstellung." },
];

async function request(path: string, body?: unknown) {
  const response = await fetchApi(path, {
    method: body === undefined ? "GET" : "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Die Regel konnte nicht gespeichert werden.");
  return data;
}

/** Who may create new Spaces. Existing Spaces and memberships are never touched by it. */
export function SpaceCreationPolicyPanel() {
  const [policy, setPolicy] = useState<Policy>({ mode: "allowed_users", providerKey: "", groupName: "" });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([request("/admin/space-creation-policy"), request("/auth/oidc/providers")])
      .then(([loaded, available]) => {
        if (!active) return;
        setPolicy(loaded);
        setReady(true);
        setProviders((available as Provider[]).filter((provider) => provider.configured));
      })
      .catch((err: Error) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const providerItems = providers.map((provider) => ({ value: provider.key, label: provider.label }));
  const claim = providers.find((provider) => provider.key === policy.providerKey)?.groupsClaim || "groups";
  const incomplete = policy.mode === "oidc_group" && (!policy.providerKey || !policy.groupName.trim());

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    void request("/admin/space-creation-policy", policy)
      .then((data) => {
        setPolicy(data);
        toast.success("Regel für neue Spaces gespeichert.");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>Wer darf Spaces erstellen?</Card.Title>
        <Card.Description>Gilt nur für neue Spaces. Bestehende Spaces und Mitgliedschaften bleiben, wie sie sind. Administration darf immer.</Card.Description>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">Regel wird geladen …</p>
        ) : (
          <form id="space-policy" onSubmit={save} className="flex flex-col gap-4">
            <RadioGroup value={policy.mode} onValueChange={(mode) => setPolicy({ ...policy, mode: String(mode) })} aria-label="Regel für neue Spaces" className="grid gap-2 sm:grid-cols-2">
              {MODES.map((mode) => (
                <RadioGroup.Card key={mode.key} value={mode.key}>
                  <RadioGroup.CardBody>
                    <RadioGroup.CardTitle>{mode.label}</RadioGroup.CardTitle>
                    <RadioGroup.CardDescription>{mode.description}</RadioGroup.CardDescription>
                  </RadioGroup.CardBody>
                </RadioGroup.Card>
              ))}
            </RadioGroup>
            {policy.mode === "oidc_group" && (
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-4">
                {providers.length ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <Field>
                        <Field.Label required>OIDC-Provider</Field.Label>
                        <Select items={providerItems} value={policy.providerKey || null} onValueChange={(value) => setPolicy({ ...policy, providerKey: String(value ?? "") })}>
                          <Select.Trigger className="w-full"><Select.Value placeholder="Provider wählen" /></Select.Trigger>
                          <Select.Content>{providerItems.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
                        </Select>
                      </Field>
                      <Field>
                        <Field.Label required>Gruppenname oder Pfad</Field.Label>
                        <Input required value={policy.groupName} maxLength={512} placeholder="/teams/space-creators" onChange={(event) => setPolicy({ ...policy, groupName: event.target.value })} />
                      </Field>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Muss exakt dem Eintrag im Claim <code className="font-mono">{claim}</code> entsprechen. Änderungen der Gruppe gelten ab der nächsten Anmeldung.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-warning">Zuerst einen aktiven OIDC-Provider unter „Anmeldung &amp; SSO“ einrichten.</p>
                )}
              </div>
            )}
            {error && (
              <Alert variant="plain" tone="destructive">
                <Alert.Icon />
                <Alert.Title>{error}</Alert.Title>
              </Alert>
            )}
          </form>
        )}
      </Card.Content>
      {!loading && (
        <Card.Footer className="justify-end">
          <Button type="submit" form="space-policy" loading={saving} disabled={!ready || incomplete}>Speichern</Button>
        </Card.Footer>
      )}
    </Card>
  );
}
