"use client";

import { SystemUser } from "@/config/apps";
import { fetchApi } from "@/lib/api";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { UserAccessPicker } from "./UserAccessPicker";

type Space = {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername?: string;
};
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
  canManage: adminManage = false,
  onOpenChange,
  onSaved,
}: {
  space: Space;
  viewerId: string;
  canManage?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const isOwner = space.ownerId === viewerId;
  const canManage = isOwner || adminManage;
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
  const visibleUsers = canManage
    ? users
    : users.filter((user) => selectedIds.has(user.id));

  const ownerName =
    users.find((user) => user.id === space.ownerId)?.username ||
    (isOwner ? "Sie" : space.ownerUsername || "Space-Eigentümer");
  const leaveSpace = async () => {
    setSaving(true);
    setError("");
    try {
      await request(`/spaces/${space.id}/members/${viewerId}`, "DELETE");
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verlassen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!saving) onOpenChange(open); }}>
      <Dialog.Content size="lg">
        <Dialog.Header
          title={canManage ? "Mitglieder verwalten" : "Mitglieder"}
          description={<>Nur Mitglieder sehen „<strong className="font-medium text-foreground">{space.name}</strong>“. Neue Mitglieder bekommen eine Einladung, die sie annehmen müssen. Eigentümer: {ownerName}.</>}
        />
        <Dialog.Body className="flex flex-col gap-4">
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
          {members.some((member) => member.groupManaged) && (
            <p className="text-xs text-muted-foreground">
              Einige Mitglieder kommen über eine OIDC-Gruppe. Ihren Zugriff ändern Sie über die Gruppe oder den Gruppenzugriff des Spaces.
            </p>
          )}
          <UserAccessPicker
            users={visibleUsers}
            ownerId={space.ownerId}
            lockedIds={new Set(members.filter((member) => member.groupManaged).map((member) => member.id))}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onUserSelected={(user) => setUsers((current) => [...current.filter((entry) => entry.id !== user.id), user])}
            loading={loading}
            disabled={saving}
            readOnly={!canManage}
            statusById={statusById}
            loadingLabel="Mitglieder werden geladen …"
          />
        </Dialog.Body>
        <Dialog.Footer>
          {!canManage && (
            <Button
              variant="ghost"
              className="me-auto"
              disabled={saving || loading || members.some((member) => member.id === viewerId && member.groupManaged)}
              onClick={() => void leaveSpace()}
            >
              Space verlassen
            </Button>
          )}
          <Dialog.Close render={<Button variant="secondary" disabled={saving} />}>{canManage ? "Abbrechen" : "Schließen"}</Dialog.Close>
          {canManage && (
            <Button loading={saving} disabled={loading || (!!error && users.length === 0)} onClick={() => void save()}>
              Speichern
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
