"use client";

import { AppConfig, AppEditorUser, SystemUser } from "@/config/apps";
import { UserAccessPicker } from "./UserAccessPicker";
import { fetchApi } from "@/lib/api";
import { Button, Modal, toast } from "@heroui/react";
import { Loader2, UsersRound } from "lucide-react";
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
    <Modal.Backdrop isOpen={!!app} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="max-w-2xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent">
              <UsersRound className="w-5 h-5" />
            </Modal.Icon>
            <Modal.Heading>Bearbeiter verwalten</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted">
                  <strong className="text-foreground">{app?.name}</strong> kann
                  von ausgewählten Benutzern bearbeitet werden, ohne die
                  Eigentümerschaft zu übertragen.
                </p>
                {app?.owner && (
                  <p className="mt-1 text-xs text-muted">
                    Besitzer:{" "}
                    <span className="font-medium text-foreground">
                      {app.owner.username}
                    </span>
                  </p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </div>
              )}
              <UserAccessPicker
                users={[...users, ...existingEditors]}
                ownerId={app?.ownerId}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                loading={loading}
                disabled={saving}
                loadingLabel="Bearbeiter werden geladen..."
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onPress={() => onOpenChange(false)}
              isDisabled={saving}
            >
              Abbrechen
            </Button>
            <Button
              className="bg-accent text-white"
              onPress={saveEditors}
              isDisabled={saving || loading}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Speichern
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
