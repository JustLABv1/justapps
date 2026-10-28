"use client";
import { Button, Modal } from "@heroui/react";
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
            <Modal.Heading>Eigentümer ändern</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-5">
            <p className="text-sm text-muted">
              Wählen Sie einen neuen Eigentümer für{" "}
              <strong className="text-foreground">{space.name}</strong>. Er
              erhält sofort die Kontrolle über den Space. Die enthaltenen Apps
              behalten ihre bisherigen Eigentümer.
            </p>
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
              Abbrechen
            </Button>
            <Button
              isPending={saving}
              isDisabled={selectedIds.size !== 1}
              onPress={save}
            >
              Eigentümer übertragen
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
