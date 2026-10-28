"use client";

import { SystemUser } from "@/config/apps";
import { fetchApi } from "@/lib/api";
import { Button, Modal, toast } from "@heroui/react";
import { UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { UserAccessPicker } from "./UserAccessPicker";

type Space = { id: string; name: string; ownerId: string };
type Member = {
  id: string;
  username: string;
  accepted: boolean;
  groupManaged?: boolean;
};

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetchApi(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.message || "Mitglieder konnten nicht gespeichert werden.",
    );
  }
  return response.status === 204 ? null : response.json();
}

export function SpaceMembersModal({
  space,
  viewerId,
  onOpenChange,
  onSaved,
}: {
  space: Space;
  viewerId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const isOwner = space.ownerId === viewerId;
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void request(`/spaces/${space.id}/members`)
      .then((loadedMembers) => {
        if (!active) return;
        const list = loadedMembers as Member[];
        setUsers(
          list.map((member) => ({
            id: member.id,
            username: member.username,
            email: "",
            role: "user",
          })),
        );
        setMembers(list);
        setSelectedIds(new Set(list.map((member) => member.id)));
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
  }, [space.id, isOwner]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const existing = new Set(members.map((member) => member.id));
      for (const id of selectedIds) {
        if (existing.has(id)) continue;
        const user = users.find((entry) => entry.id === id);
        if (!user?.email)
          throw new Error(
            "Für diesen Nutzer ist keine E-Mail-Adresse hinterlegt.",
          );
        await request(`/spaces/${space.id}/invitations`, "POST", {
          email: user.email,
        });
      }
      for (const member of members) {
        if (!member.groupManaged && !selectedIds.has(member.id))
          await request(`/spaces/${space.id}/members/${member.id}`, "DELETE");
      }
      toast.success("Mitglieder und Einladungen wurden gespeichert.");
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      );
      // Keep successful partial changes in sync so retries never repeat a removal.
      try {
        setMembers(await request(`/spaces/${space.id}/members`));
      } catch {
        /* Keep the original error visible. */
      }
    } finally {
      setSaving(false);
    }
  };
  const statusById = Object.fromEntries(
    users.map((user) => {
      const member = members.find((entry) => entry.id === user.id);
      return [
        user.id,
        member
          ? member.groupManaged
            ? "Über OIDC verwaltet"
            : member.accepted
              ? "Mitglied"
              : "Eingeladen"
          : selectedIds.has(user.id)
            ? "Neue Einladung"
            : user.authType || user.role,
      ];
    }),
  );
  const visibleUsers = isOwner
    ? users
    : users.filter((user) => selectedIds.has(user.id));

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
              <UsersRound className="h-5 w-5" />
            </Modal.Icon>
            <Modal.Heading>
              {isOwner ? "Mitglieder verwalten" : "Mitglieder ansehen"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted">
                  <strong className="text-foreground">{space.name}</strong> ist
                  nur für ausgewählte Mitglieder sichtbar. Neue Mitglieder
                  erhalten eine Einladung und müssen diese annehmen.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Besitzer:{" "}
                  <span className="font-medium text-foreground">
                    {users.find((user) => user.id === space.ownerId)
                      ?.username || (isOwner ? "Sie" : "Space-Eigentümer")}
                  </span>
                </p>
              </div>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </div>
              )}
              {members.some((member) => member.groupManaged) && (
                <p className="text-xs leading-relaxed text-muted">
                  Gruppenverwaltete Mitglieder werden über OIDC berechtigt.
                  Ändern Sie deren Zugriff über die Gruppe oder die
                  Gruppenzuordnung des Spaces.
                </p>
              )}
              <UserAccessPicker
                users={visibleUsers}
                ownerId={space.ownerId}
                lockedIds={
                  new Set(
                    members
                      .filter((member) => member.groupManaged)
                      .map((member) => member.id),
                  )
                }
                selectedIds={selectedIds}
                onChange={setSelectedIds}
                onUserSelected={(user) =>
                  setUsers((current) => [
                    ...current.filter((entry) => entry.id !== user.id),
                    user,
                  ])
                }
                loading={loading}
                disabled={saving}
                readOnly={!isOwner}
                statusById={statusById}
                loadingLabel="Mitglieder werden geladen..."
              />
            </div>
          </Modal.Body>
          <Modal.Footer>
            {!isOwner && (
              <Button
                variant="ghost"
                isDisabled={
                  saving ||
                  loading ||
                  members.some(
                    (member) => member.id === viewerId && member.groupManaged,
                  )
                }
                onPress={async () => {
                  setSaving(true);
                  setError("");
                  try {
                    await request(
                      `/spaces/${space.id}/members/${viewerId}`,
                      "DELETE",
                    );
                    await onSaved();
                    onOpenChange(false);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Verlassen fehlgeschlagen.",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Space verlassen
              </Button>
            )}
            <Button
              variant="secondary"
              isDisabled={saving}
              onPress={() => onOpenChange(false)}
            >
              {isOwner ? "Abbrechen" : "Schließen"}
            </Button>
            {isOwner && (
              <Button
                className="bg-accent text-white"
                isPending={saving}
                isDisabled={loading || (!!error && users.length === 0)}
                onPress={save}
              >
                Speichern
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
