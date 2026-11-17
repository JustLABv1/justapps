"use client";

import { AppConfig, AppEditorUser, SystemUser } from "@/config/apps";
import { authorName } from "@/components/profile/UserAvatar";
import { UserAccessPicker } from "./UserAccessPicker";
import { fetchApi } from "@/lib/api";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";

interface AppEditorsModalProps {
  app: AppConfig | null;
  users?: SystemUser[];
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void | Promise<void>;
}

export function AppEditorsModal({
  app,
  users = [],
  onOpenChange,
  onSaved,
}: AppEditorsModalProps) {
  const [existingEditors, setExistingEditors] = useState<SystemUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(Boolean(app));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!app) {
      return;
    }

    let active = true;
    fetchApi(`/apps/${app.id}/editors`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (data as { message?: string }).message ||
              "Bearbeiter konnten nicht geladen werden.",
          );
        }
        if (!active) return;
        const editors = (
          (data as { editors?: AppEditorUser[] }).editors || []
        ).filter((user) => !user.disabled);
        setExistingEditors(editors);
        setError(null);
        setSelectedIds(new Set(editors.map((user) => user.id)));
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Bearbeiter konnten nicht geladen werden.",
        );
        setSelectedIds(new Set());
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [app]);

  const saveEditors = async () => {
    if (!app) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetchApi(`/apps/${app.id}/editors`, {
        method: "PUT",
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (data as { message?: string }).message ||
            "Bearbeiter konnten nicht gespeichert werden.",
        );
      }
      toast.success("Bearbeiter wurden gespeichert.");
      await onSaved?.();
      onOpenChange(false);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Bearbeiter konnten nicht gespeichert werden.";
      setError(message);
      toast.danger(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!app} onOpenChange={onOpenChange}>
      <Dialog.Content size="lg">
        <Dialog.Header
          title="Bearbeiter verwalten"
          description={
            <>
              <strong className="font-medium text-foreground">{app?.name}</strong> kann von ausgewählten Personen bearbeitet werden, ohne dass sich die Eigentümerschaft ändert.
              {app?.owner && <> Eigentümer: <span className="font-medium text-foreground">{authorName(app.owner)}</span>.</>}
            </>
          }
        />
        <Dialog.Body>
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
          <UserAccessPicker
            users={[...users, ...existingEditors]}
            ownerId={app?.ownerId}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            loading={loading}
            disabled={saving}
            loadingLabel="Bearbeiter werden geladen …"
          />
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
          <Button loading={saving} disabled={loading} onClick={() => void saveEditors()}>
            Speichern
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
