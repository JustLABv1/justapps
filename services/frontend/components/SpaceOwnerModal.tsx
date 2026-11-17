"use client";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { useState } from "react";
import { UserAccessPicker } from "./UserAccessPicker";
import { fetchApi } from "@/lib/api";

export function SpaceOwnerModal({
  space,
  onOpenChange,
  onSaved,
}: {
  space: { id: string; name: string; ownerId: string };
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    const userId = Array.from(selectedIds)[0];
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetchApi(`/spaces/${space.id}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.message || "Eigentümer konnte nicht geändert werden.",
        );
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Übertragung fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <Dialog.Content size="lg">
        <Dialog.Header
          title="Eigentümer ändern"
          description={<>Wer soll <strong className="font-medium text-foreground">{space.name}</strong> künftig gehören? Die Person erhält sofort die Kontrolle über den Space. Die enthaltenen Apps behalten ihre Eigentümer.</>}
        />
        <Dialog.Body className="flex flex-col gap-4">
          <UserAccessPicker
            users={[]}
            ownerId={space.ownerId}
            selectedIds={selectedIds}
            disabled={saving}
            onChange={(ids) => {
              const next = Array.from(ids).find((id) => !selectedIds.has(id));
              setSelectedIds(new Set(next ? [next] : []));
            }}
          />
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>Abbrechen</Dialog.Close>
          <Button loading={saving} disabled={selectedIds.size !== 1} onClick={() => void save()}>
            Eigentümer übertragen
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
