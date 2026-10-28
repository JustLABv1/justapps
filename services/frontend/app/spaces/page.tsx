"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  Package,
  ChevronRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { fetchApi } from "@/lib/api";
import { AppConfig } from "@/config/apps";

type Space = { id: string; name: string; ownerId: string; accepted: boolean };
type Member = { id: string; username: string; accepted: boolean };

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
  const [selectedId, setSelectedId] = useState("");
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loadedContentId, setLoadedContentId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [editSpace, setEditSpace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteSpace, setDeleteSpace] = useState<Space | null>(null);
  const [publish, setPublish] = useState<AppConfig | null>(null);
  const selected = spaces.find(
    (space) => space.id === selectedId && space.accepted,
  );

  const loadSpaces = useCallback(async () => {
    const data: Space[] = await (await request("/spaces")).json();
    setSpaces(data);
    setSelectedId((current) =>
      data.some((space) => space.id === current && space.accepted)
        ? current
        : data.find((space) => space.accepted)?.id || "",
    );
  }, []);

  useEffect(() => {
    if (!user || !profileReady) return;
    let active = true;
    void request("/spaces")
      .then((response) => response.json())
      .then((data: Space[]) => {
        if (!active) return;
        setSpaces(data);
        setSelectedId(data.find((space) => space.accepted)?.id || "");
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

  const loadContent = useCallback(async (id: string) => {
    const [appsResponse, membersResponse] = await Promise.all([
      request(`/apps?spaceId=${encodeURIComponent(id)}`),
      request(`/spaces/${id}/members`),
    ]);
    return {
      apps: (await appsResponse.json()) as AppConfig[],
      members: (await membersResponse.json()) as Member[],
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void loadContent(selectedId)
      .then((data) => {
        if (active) {
          setApps(data.apps);
          setLoadedContentId(selectedId);
          setMembers(data.members);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setApps([]);
          setMembers([]);
          setError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId, loadContent]);

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
          title="Private Spaces"
          description="Melden Sie sich an, um persönliche oder gemeinsame private Apps zu verwalten."
        />
      </PageContainer>
    );

  const canCreate = user.canSubmitApps || user.role === "admin";
  const isOwner = selected?.ownerId === user.id;
  const openCreate = () => {
    setName("");
    setError("");
    setCreateOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Arbeitsbereich"
        title="Private Spaces"
        description="Ihre Apps. Ihr Team. Ein gemeinsamer, geschützter Bereich."
        actions={
          <Button onPress={openCreate}>
            <Plus className="h-4 w-4" />
            Space erstellen
          </Button>
        }
      />
      {error && !createOpen && !editSpace && !inviteOpen && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {spaces.some((space) => !space.accepted) && (
        <div className="space-y-2">
          {spaces
            .filter((space) => !space.accepted)
            .map((space) => (
              <div
                key={space.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3"
              >
                <UserPlus className="h-4 w-4 text-accent" />
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
        </div>
      )}
      {loading ? (
        <p role="status" className="py-12 text-center text-sm text-muted">
          Spaces werden geladen …
        </p>
      ) : selected ? (
        <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav
            aria-label="Ihre Spaces"
            className="lg:border-r lg:border-border lg:pr-5"
          >
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Ihre Spaces
            </p>
            <div className="flex gap-1 overflow-x-auto lg:flex-col">
              {spaces
                .filter((space) => space.accepted)
                .map((space) => (
                  <button
                    type="button"
                    key={space.id}
                    aria-current={selectedId === space.id ? "page" : undefined}
                    onClick={() => {
                      setSelectedId(space.id);
                      setError("");
                    }}
                    className={`flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selectedId === space.id ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface-secondary hover:text-foreground"}`}
                  >
                    <LockKeyhole className="h-4 w-4 shrink-0" />
                    <span className="truncate">{space.name}</span>
                  </button>
                ))}
            </div>
          </nav>
          <section className="min-w-0">
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                  <LockKeyhole className="h-5 w-5 text-muted" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-semibold tracking-tight">
                      {selected.name}
                    </h2>
                    {isOwner && (
                      <Dropdown>
                        <Button
                          isIconOnly
                          variant="ghost"
                          size="sm"
                          aria-label="Space verwalten"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Dropdown.Popover placement="bottom start">
                          <Dropdown.Menu
                            aria-label="Space verwalten"
                            onAction={(key) => {
                              setError("");
                              if (key === "rename")
                                setEditSpace({
                                  id: selected.id,
                                  name: selected.name,
                                });
                              if (key === "delete") setDeleteSpace(selected);
                            }}
                          >
                            <Dropdown.Item id="rename" textValue="Umbenennen">
                              <Pencil className="h-4 w-4 text-muted" />
                              <Label>Umbenennen</Label>
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
                  <p className="mt-1 text-xs text-muted">
                    Privater Space ·{" "}
                    {loadedContentId === selected.id
                      ? `${members.filter((member) => member.accepted).length + 1} ${members.filter((member) => member.accepted).length === 0 ? "Mitglied" : "Mitglieder"}`
                      : "Wird geladen …"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onPress={() => router.push(`/?spaceId=${selected.id}`)}
                >
                  Im Katalog öffnen
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                {canCreate && (
                  <Button
                    onPress={() =>
                      router.push(`/meine-apps/new?spaceId=${selected.id}`)
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Neue App
                  </Button>
                )}
              </div>
            </header>
            {loadedContentId !== selected.id ? (
              <p role="status" className="py-16 text-center text-sm text-muted">
                Apps und Mitglieder werden geladen …
              </p>
            ) : (
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_248px]">
                <div className="min-w-0">
                  <div className="mb-3 flex h-8 items-center gap-2">
                    <h3 className="text-sm font-semibold">Apps</h3>
                    <span className="text-xs tabular-nums text-muted">
                      {apps.length}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-surface">
                    {apps.length ? (
                      <div className="divide-y divide-border">
                        {apps.map((app) => (
                          <article
                            key={app.id}
                            className="flex items-center gap-3 p-4"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary">
                              <Package className="h-5 w-5 text-muted" />
                            </span>
                            <Link
                              href={`/apps/${app.id}`}
                              className="min-w-0 flex-1"
                            >
                              <h4 className="truncate text-sm font-semibold hover:text-accent">
                                {app.name}
                              </h4>
                              <p className="mt-1 line-clamp-1 text-xs text-muted">
                                {app.description || "Noch keine Beschreibung"}
                              </p>
                            </Link>
                            <Dropdown>
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                aria-label={`Aktionen für ${app.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                              <Dropdown.Popover placement="bottom end">
                                <Dropdown.Menu
                                  aria-label={`Aktionen für ${app.name}`}
                                  onAction={(key) => {
                                    if (key === "publish") {
                                      setError("");
                                      setPublish(app);
                                    }
                                  }}
                                >
                                  <Dropdown.Item
                                    id="open"
                                    href={`/apps/${app.id}`}
                                    textValue="App öffnen"
                                  >
                                    <ArrowUpRight className="h-4 w-4 text-muted" />
                                    <Label>App öffnen</Label>
                                  </Dropdown.Item>
                                  {app.viewerPermissions?.canEdit && (
                                    <Dropdown.Item
                                      id="edit"
                                      href={`/meine-apps/${app.id}/edit`}
                                      textValue="Bearbeiten"
                                    >
                                      <Pencil className="h-4 w-4 text-muted" />
                                      <Label>Bearbeiten</Label>
                                    </Dropdown.Item>
                                  )}
                                  {app.ownerId === user.id && (
                                    <Dropdown.Item
                                      id="publish"
                                      isDisabled={app.isLocked || pending}
                                      textValue="Für alle veröffentlichen"
                                    >
                                      <Users className="h-4 w-4 text-muted" />
                                      <Label>Für alle veröffentlichen</Label>
                                    </Dropdown.Item>
                                  )}
                                </Dropdown.Menu>
                              </Dropdown.Popover>
                            </Dropdown>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary">
                          <Package className="h-6 w-6 text-muted" />
                        </div>
                        <h3 className="text-base font-semibold">
                          Ihre erste App beginnt hier
                        </h3>
                        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                          Apps in diesem Space bleiben für Sie und Ihr Team
                          sichtbar.
                        </p>
                        {canCreate && (
                          <Link
                            href={`/meine-apps/new?spaceId=${selected.id}`}
                            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent"
                          >
                            App erstellen
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <aside>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Mitglieder</h3>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Mitglied einladen"
                        onPress={() => {
                          setEmail("");
                          setError("");
                          setInviteOpen(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4" />Einladen
                      </Button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                        {isOwner ? (
                          user.username.slice(0, 2).toUpperCase()
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {isOwner
                            ? `${user.username} (Sie)`
                            : "Space-Eigentümer"}
                        </p>
                        <p className="text-xs text-muted">Eigentümer</p>
                      </div>
                    </div>
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="mt-4 flex items-center gap-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-medium text-muted">
                          {member.username.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {member.username}
                            {member.id === user.id ? " (Sie)" : ""}
                          </p>
                          <p className="text-xs text-muted">
                            {member.accepted ? "Mitglied" : "Eingeladen"}
                          </p>
                        </div>
                        {(isOwner || member.id === user.id) && (
                          <Dropdown>
                            <Button
                              isIconOnly
                              variant="ghost"
                              size="sm"
                              aria-label={`Mitglied ${member.username} verwalten`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            <Dropdown.Popover placement="bottom end">
                              <Dropdown.Menu
                                onAction={() =>
                                  void act(async () => {
                                    await request(
                                      `/spaces/${selected.id}/members/${member.id}`,
                                      "DELETE",
                                    );
                                    await loadSpaces();
                                    setMembers((current) =>
                                      current.filter(
                                        (entry) => entry.id !== member.id,
                                      ),
                                    );
                                  })
                                }
                              >
                                <Dropdown.Item
                                  id="remove"
                                  textValue={
                                    member.id === user.id
                                      ? "Space verlassen"
                                      : "Entfernen"
                                  }
                                  className="text-danger"
                                >
                                  <Label>
                                    {member.id === user.id
                                      ? "Space verlassen"
                                      : member.accepted
                                        ? "Entfernen"
                                        : "Einladung zurückziehen"}
                                  </Label>
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        )}
                      </div>
                    ))}

                  </div>
                  <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
                    Nur eingeladene Mitglieder haben Zugriff auf diesen Space.
                  </p>
                </aside>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary">
            <LockKeyhole className="h-6 w-6 text-muted" />
          </div>
          <h2 className="text-lg font-semibold">Ein Platz für Ihre Ideen</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Erstellen Sie einen Space für sich oder laden Sie Ihr Team ein.
          </p>
          <Button variant="secondary" className="mt-5" onPress={openCreate}>
            <Plus className="h-4 w-4" />
            Ersten Space erstellen
          </Button>
        </div>
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
            const created: Space = await (
              await request("/spaces", "POST", { name })
            ).json();
            await loadSpaces();
            setSelectedId(created.id);
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
      <SpaceFormDialog
        isOpen={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Mitglied einladen"
        description="Die Einladung erscheint im Konto des Nutzers. Der Zugriff beginnt nach Annahme."
        label="E-Mail-Adresse"
        placeholder="name@beispiel.de"
        type="email"
        value={email}
        onChange={setEmail}
        pending={pending}
        error={error}
        submitLabel="Einladung senden"
        onSubmit={() =>
          void act(async () => {
            if (!selected) return;
            await request(`/spaces/${selected.id}/invitations`, "POST", {
              email,
            });
            const content = await loadContent(selected.id);
            setMembers(content.members);
            setInviteOpen(false);
            setEmail("");
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
            setApps([]);
            setMembers([]);
            setDeleteSpace(null);
            await loadSpaces();
          })
        }
      />
      <ConfirmDialog
        isOpen={!!publish}
        onOpenChange={(open) => {
          if (!open) setPublish(null);
        }}
        title="App für alle veröffentlichen?"
        description={`„${publish?.name || ""}“ verlässt den privaten Space. Beschreibung, Dokumentation und Diskussionen werden im öffentlichen Katalog für alle zugänglich.${error ? ` ${error}` : ""}`}
        confirmLabel="Jetzt veröffentlichen"
        isLoading={pending}
        onConfirm={() =>
          void act(async () => {
            if (!publish) return;
            await request(`/apps/${publish.id}/publish`, "POST");
            setApps((current) =>
              current.filter((app) => app.id !== publish.id),
            );
            setPublish(null);
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
