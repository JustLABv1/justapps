"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dropdown,
  Label,
  Input,
  Modal,
  TextField,
  Separator,
} from "@heroui/react";
import {
  LockKeyhole,
  Plus,
  Users,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { SpaceGroupMappingsModal } from "@/components/SpaceGroupMappingsModal";
import { SpaceMembersModal } from "@/components/SpaceMembersModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/lib/api";

type Space = { id: string; name: string; ownerId: string; accepted: boolean };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetchApi(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || "Die Aktion konnte nicht abgeschlossen werden.",
    );
  }
  return response;
}

export default function SpacesPage() {
  const router = useRouter();
  const { user, loading: authLoading, profileReady } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [groupSpace, setGroupSpace] = useState<Space | null>(null);
  const [memberSpace, setMemberSpace] = useState<Space | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [editSpace, setEditSpace] = useState<Space | null>(null);
  const [deleteSpace, setDeleteSpace] = useState<Space | null>(null);

  const loadSpaces = useCallback(async () => {
    setSpaces(await (await request("/spaces")).json());
  }, []);
  useEffect(() => {
    if (!user || !profileReady) return;
    let active = true;
    void request("/spaces")
      .then((response) => response.json())
      .then((data: Space[]) => {
        if (active) setSpaces(data);
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
  }, [user, profileReady]);

  const act = async (action: () => Promise<void>) => {
    setPending(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  };
  const openMembers = (space: Space) => {
    setError("");
    setMemberSpace(space);
  };
  const openCreate = () => {
    setName("");
    setError("");
    setCreateOpen(true);
  };

  if (authLoading || (user && !profileReady))
    return (
      <PageContainer>
        <p role="status">Profil wird geladen …</p>
      </PageContainer>
    );
  if (!user)
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Arbeitsbereich"
          title="Spaces verwalten"
          description="Melden Sie sich an, um Ihre privaten Bereiche zu verwalten."
        />
      </PageContainer>
    );
  const accepted = spaces.filter((space) => space.accepted);
  const invitations = spaces.filter((space) => !space.accepted);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Arbeitsbereich"
        title="Spaces verwalten"
        description="Erstellen Sie private Bereiche und legen Sie fest, wer Zugriff hat. Ihre Apps finden Sie im Katalog."
        actions={
          <Button onPress={openCreate}>
            <Plus className="h-4 w-4" />
            Space erstellen
          </Button>
        }
      />
      {error && !memberSpace && !createOpen && !editSpace && !deleteSpace && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Einladungen</h2>
          {invitations.map((space) => (
            <div
              key={space.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4"
            >
              <UserPlus className="h-5 w-5 text-accent" />
              <p className="flex-1 text-sm">
                Einladung zu <strong>{space.name}</strong>
              </p>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={pending}
                onPress={() =>
                  void act(async () => {
                    await request(
                      `/spaces/${space.id}/members/${user.id}`,
                      "DELETE",
                    );
                    await loadSpaces();
                  })
                }
              >
                Ablehnen
              </Button>
              <Button
                size="sm"
                isDisabled={pending}
                onPress={() =>
                  void act(async () => {
                    await request(`/spaces/${space.id}/accept`, "POST");
                    await loadSpaces();
                  })
                }
              >
                Annehmen
              </Button>
            </div>
          ))}
        </section>
      )}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold">Ihre Spaces</h2>
          {!loading && (
            <span className="text-sm text-muted">{accepted.length}</span>
          )}
        </div>
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-muted">
            Spaces werden geladen …
          </p>
        ) : accepted.length ? (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {accepted.map((space) => (
              <article
                key={space.id}
                className="flex flex-wrap items-center gap-4 p-5 sm:p-6"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <LockKeyhole className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{space.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    Privat ·{" "}
                    {space.ownerId === user.id ? "Eigentümer" : "Mitglied"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Mitglieder von ${space.name} ${space.ownerId === user.id ? "verwalten" : "ansehen"}`}
                    onPress={() => void openMembers(space)}
                  >
                    <Users className="h-4 w-4" />
                    Mitglieder
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/?spaceId=${space.id}`)}
                  >
                    Apps öffnen
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  {space.ownerId === user.id && (
                    <Dropdown>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`${space.name} verwalten`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu
                          aria-label={`${space.name} verwalten`}
                          onAction={(key) => {
                            setError("");
                            if (key === "groups") setGroupSpace(space);
                            if (key === "rename") setEditSpace(space);
                            if (key === "delete") setDeleteSpace(space);
                          }}
                        >
                          <Dropdown.Item id="rename" textValue="Umbenennen">
                            <Pencil className="h-4 w-4 text-muted" />
                            <Label>Umbenennen</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="groups" textValue="Gruppenzugriff">
                            <Users className="h-4 w-4 text-muted" />
                            <Label>Gruppenzugriff</Label>
                          </Dropdown.Item>
                          <Separator />
                          <Dropdown.Item
                            id="delete"
                            textValue="Space löschen"
                            className="text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                            <Label>Space löschen</Label>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <LockKeyhole className="mb-4 h-7 w-7 text-muted" />
            <h3 className="font-semibold">Noch kein privater Space</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Ein Space hält Ihre Apps privat. Laden Sie bei Bedarf weitere
              Mitglieder ein.
            </p>
            <Button variant="secondary" className="mt-5" onPress={openCreate}>
              <Plus className="h-4 w-4" />
              Ersten Space erstellen
            </Button>
          </div>
        )}
      </section>
      {groupSpace && (
        <SpaceGroupMappingsModal
          key={groupSpace.id}
          space={groupSpace}
          onOpenChange={(open) => {
            if (!open) setGroupSpace(null);
          }}
        />
      )}
      {memberSpace && (
        <SpaceMembersModal
          key={memberSpace.id}
          space={memberSpace}
          viewerId={user.id}
          onOpenChange={(open) => {
            if (!open) setMemberSpace(null);
          }}
          onSaved={loadSpaces}
        />
      )}
      <SpaceFormDialog
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        title="Space erstellen"
        description="Ein privater Bereich für Ihre Apps. Mitglieder können Sie anschließend einladen."
        label="Name"
        placeholder="z. B. Projektteam"
        value={name}
        onChange={setName}
        pending={pending}
        error={error}
        submitLabel="Space erstellen"
        onSubmit={() =>
          void act(async () => {
            await request("/spaces", "POST", { name });
            await loadSpaces();
            setCreateOpen(false);
            setName("");
          })
        }
      />
      <SpaceFormDialog
        isOpen={!!editSpace}
        onOpenChange={(open) => {
          if (!open) setEditSpace(null);
        }}
        title="Space umbenennen"
        description="Der neue Name wird für alle Mitglieder übernommen."
        label="Name"
        value={editSpace?.name || ""}
        onChange={(value) =>
          setEditSpace((current) =>
            current ? { ...current, name: value } : null,
          )
        }
        pending={pending}
        error={error}
        submitLabel="Speichern"
        onSubmit={() =>
          void act(async () => {
            if (!editSpace) return;
            await request(`/spaces/${editSpace.id}`, "PATCH", {
              name: editSpace.name,
            });
            await loadSpaces();
            setEditSpace(null);
          })
        }
      />
      <ConfirmDialog
        isOpen={!!deleteSpace}
        onOpenChange={(open) => {
          if (!open) setDeleteSpace(null);
        }}
        title="Space endgültig löschen?"
        description={`„${deleteSpace?.name || ""}“ und alle enthaltenen privaten Apps werden unwiderruflich gelöscht. Dies betrifft auch Apps anderer Mitglieder. Bereits veröffentlichte Apps bleiben erhalten.${error ? ` ${error}` : ""}`}
        confirmLabel="Space und Apps löschen"
        isDanger
        isLoading={pending}
        onConfirm={() =>
          void act(async () => {
            if (!deleteSpace) return;
            await request(`/spaces/${deleteSpace.id}`, "DELETE");
            await loadSpaces();
            setDeleteSpace(null);
          })
        }
      />
    </PageContainer>
  );
}

function SpaceFormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  value,
  onChange,
  pending,
  error,
  submitLabel,
  onSubmit,
  type = "text",
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error: string;
  submitLabel: string;
  onSubmit: () => void;
  type?: "text" | "email";
}) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!pending) onOpenChange(open);
        }}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-5">
                <p className="text-sm leading-relaxed text-muted">
                  {description}
                </p>
                <TextField isRequired value={value} onChange={onChange}>
                  <Label>{label}</Label>
                  <Input
                    autoFocus
                    type={type}
                    maxLength={type === "text" ? 100 : 254}
                    placeholder={placeholder}
                  />
                </TextField>
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  isDisabled={pending}
                  onPress={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  isPending={pending}
                  isDisabled={!value.trim()}
                >
                  {submitLabel}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
