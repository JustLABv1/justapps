"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/panelui/alert";
import { Badge } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Dialog } from "@/components/panelui/dialog";
import { Field } from "@/components/panelui/field";
import { Input } from "@/components/panelui/input";
import { Menu } from "@/components/panelui/menu";
import { Pagination } from "@/components/panelui/pagination";
import { Spinner } from "@/components/panelui/spinner";
import {
  ArrowUpRight,
  FolderLock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react";
import NextLink from "next/link";
import { SpaceGroupMappingsModal } from "@/components/SpaceGroupMappingsModal";
import { SpaceOwnerModal } from "@/components/SpaceOwnerModal";
import { SpaceMembersModal } from "@/components/SpaceMembersModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { Permission, hasPermission, canOverseeSpaces } from "@/lib/permissions";
import { fetchApi } from "@/lib/api";

type Space = {
  id: string;
  name: string;
  ownerId: string;
  accepted: boolean;
  ownerUsername?: string;
  ownerEmail?: string;
  appCount?: number;
  memberCount?: number;
  invitationCount?: number;
  canViewApps?: boolean;
  groupCount?: number;
};

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

export function SpacesManager({ adminMode = false }: { adminMode?: boolean }) {
  const { user, loading: authLoading, profileReady } = useAuth();
  const [creationAccess, setCreationAccess] = useState<{
    userId: string;
    mode: string;
    canCreate: boolean;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [ownerSpace, setOwnerSpace] = useState<Space | null>(null);
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

  useEffect(() => {
    if (!user || !profileReady || user.role === "admin") return;
    let active = true;
    void request("/spaces/creation-policy")
      .then((response) => response.json())
      .then((data) => {
        if (active) setCreationAccess({ ...data, userId: user.id });
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [user, profileReady]);
  const canOversee = canOverseeSpaces(user?.role, user?.permissions);
  const permitted = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(user?.role, permission, user?.permissions);
  const endpoint = adminMode
    ? `/spaces/management?q=${encodeURIComponent(query)}&page=${page}`
    : "/spaces";
  const readSpaces = useCallback(async () => {
    const data = await (await request(endpoint)).json();
    return {
      items: adminMode ? data.items : data,
      total: adminMode ? data.total : data.length,
    };
  }, [endpoint, adminMode]);
  const loadSpaces = useCallback(async () => {
    const data = await readSpaces();
    setSpaces(data.items);
    setTotal(data.total);
    if (adminMode)
      setPage((current) =>
        Math.min(current, Math.max(1, Math.ceil(data.total / 50))),
      );
  }, [readSpaces, adminMode]);
  useEffect(() => {
    if (!user || !profileReady || (adminMode && !canOversee)) return;
    let active = true;
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        void readSpaces()
          .then((data) => {
            if (active) {
              setSpaces(data.items);
              setTotal(data.total);
              if (adminMode)
                setPage((current) =>
                  Math.min(current, Math.max(1, Math.ceil(data.total / 50))),
                );
            }
          })
          .catch((err: Error) => {
            if (active) setError(err.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      adminMode ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user, profileReady, readSpaces, adminMode, canOversee]);

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

  const header = (actions?: React.ReactNode, description?: string) => (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{adminMode ? "Private Spaces" : "Ihre Spaces"}</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );

  if (authLoading || (user && !profileReady))
    return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!user)
    return <div className="flex flex-col gap-6">{header(undefined, "Melden Sie sich an, um Ihre privaten Bereiche zu verwalten.")}</div>;
  if (adminMode && !canOversee)
    return (
      <Alert variant="plain" tone="destructive">
        <Alert.Icon />
        <Alert.Title>Keine Berechtigung zur Space-Verwaltung.</Alert.Title>
      </Alert>
    );

  const canCreate = user.role === "admin" || (creationAccess?.userId === user.id && creationAccess.canCreate);
  const accepted = spaces.filter((space) => space.accepted);
  const invitations = spaces.filter((space) => !space.accepted);
  const pageCount = Math.max(1, Math.ceil(total / 50));
  const ownsOr = (space: Space, permission: Parameters<typeof hasPermission>[1]) => space.ownerId === user.id || permitted(permission);
  const dialogOpen = !!memberSpace || createOpen || !!editSpace || !!deleteSpace;

  return (
    <div className="flex flex-col gap-6">
      {header(
        <>
          {adminMode && user.role === "admin" && (
            <Button variant="secondary" render={<NextLink href="/verwaltung/sicherheit/zugriff" />}>
              <ShieldCheck />
              Wer darf Spaces erstellen?
            </Button>
          )}
          {!adminMode && canOversee && (
            <Button variant="secondary" render={<NextLink href={user.role === "admin" ? "/verwaltung/katalog/spaces" : "/spaces/verwaltung"} />}>
              Alle Spaces verwalten
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus />
              Space erstellen
            </Button>
          )}
        </>,
        adminMode
          ? "Alle privaten Bereiche der Plattform mit Eigentümern, Mitgliedern und Gruppenzugriff."
          : "Private Bereiche für Apps, die nur ihre Mitglieder sehen. Die Apps selbst finden Sie im Katalog.",
      )}

      {error && !dialogOpen && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      {invitations.length > 0 && (
        <Card className="gap-0 py-0" render={<section aria-label="Einladungen" />}>
          <ul className="divide-y">
            {invitations.map((space) => (
              <li key={space.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info"><UserPlus className="size-4" /></span>
                <p className="min-w-0 flex-1 text-sm">Sie sind zu <strong className="font-medium">{space.name}</strong> eingeladen.</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void act(async () => { await request(`/spaces/${space.id}/members/${user.id}`, "DELETE"); await loadSpaces(); })}
                >
                  Ablehnen
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => void act(async () => { await request(`/spaces/${space.id}/accept`, "POST"); await loadSpaces(); })}
                >
                  Annehmen
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="spaces-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="spaces-heading" className="text-sm font-medium text-muted-foreground">
            {adminMode ? "Alle Spaces" : "Ihre Spaces"}{!loading && ` · ${adminMode ? total : accepted.length}`}
          </h2>
          {adminMode && (
            <Input.Group size="sm" className="ms-auto w-full sm:w-72">
              <Input.Addon><Search /></Input.Addon>
              <Input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                aria-label="Spaces durchsuchen"
                placeholder="Space oder Eigentümer"
              />
            </Input.Group>
          )}
        </div>
        {!adminMode && !canCreate && (
          <p className="text-sm text-muted-foreground">
            {creationAccess?.mode === "admins"
              ? "Neue Spaces erstellt nur die Administration."
              : creationAccess?.mode === "oidc_group"
                ? "Neue Spaces dürfen nur Mitglieder einer bestimmten OIDC-Gruppe erstellen. Geprüft wird bei der Anmeldung."
                : "Neue Spaces dürfen nur freigegebene Nutzer erstellen. Ihre bestehenden Spaces bleiben nutzbar."}
          </p>
        )}
        {loading ? (
          <Card className="gap-0 py-0">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
                <span className="size-10 animate-pulse rounded-xl bg-muted" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <span className="h-3 w-64 animate-pulse rounded bg-muted" />
                </span>
              </div>
            ))}
          </Card>
        ) : accepted.length ? (
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {accepted.map((space) => {
                const owner = space.ownerId === user.id;
                const showMenu = owner || [Permission.ManageSpaces, Permission.ManageSpaceGroups, Permission.TransferSpaceOwnership, Permission.DeleteSpaces].some(permitted);
                return (
                  <li key={space.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderLock className="size-5" /></span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{space.name}</span>
                        {!adminMode && <Badge variant={owner ? "info" : "secondary"} size="sm">{owner ? "Eigentümer" : "Mitglied"}</Badge>}
                      </span>
                      {adminMode ? (
                        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span title={space.ownerEmail}>Eigentümer: {space.ownerUsername || space.ownerId}</span>
                          <span>{space.appCount || 0} {space.appCount === 1 ? "App" : "Apps"}</span>
                          <span>{space.memberCount || 1} {(space.memberCount || 1) === 1 ? "Mitglied" : "Mitglieder"}</span>
                          {(space.invitationCount || 0) > 0 && <span>{space.invitationCount} {space.invitationCount === 1 ? "offene Einladung" : "offene Einladungen"}</span>}
                          {(space.groupCount || 0) > 0 && <span>{space.groupCount} {space.groupCount === 1 ? "OIDC-Gruppe" : "OIDC-Gruppen"}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Nur für Mitglieder sichtbar</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {(!adminMode || owner || permitted(Permission.ManageSpaceMembers)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Mitglieder von ${space.name} ${permitted(Permission.ManageSpaceMembers) || owner ? "verwalten" : "ansehen"}`}
                          onClick={() => openMembers(space)}
                        >
                          <Users />
                          Mitglieder
                        </Button>
                      )}
                      {(!adminMode || space.canViewApps) && (
                        <Button variant="secondary" size="sm" render={<NextLink href={`/?spaceId=${space.id}`} />}>
                          Apps öffnen
                          <ArrowUpRight />
                        </Button>
                      )}
                      {showMenu && (
                        <Menu>
                          <Menu.Trigger render={<Button variant="ghost" size="icon-sm" aria-label={`${space.name} verwalten`} />}>
                            <MoreHorizontal />
                          </Menu.Trigger>
                          <Menu.Content align="end" className="min-w-52">
                            {ownsOr(space, Permission.ManageSpaces) && (
                              <Menu.Item onClick={() => { setError(""); setEditSpace(space); }}><Pencil />Umbenennen</Menu.Item>
                            )}
                            {ownsOr(space, Permission.ManageSpaceGroups) && (
                              <Menu.Item onClick={() => { setError(""); setGroupSpace(space); }}><ShieldCheck />Gruppenzugriff</Menu.Item>
                            )}
                            {permitted(Permission.TransferSpaceOwnership) && (
                              <Menu.Item onClick={() => { setError(""); setOwnerSpace(space); }}><UserRoundCog />Eigentümer ändern</Menu.Item>
                            )}
                            {ownsOr(space, Permission.DeleteSpaces) && (
                              <>
                                <Menu.Separator />
                                <Menu.Item variant="destructive" onClick={() => { setError(""); setDeleteSpace(space); }}><Trash2 />Space löschen</Menu.Item>
                              </>
                            )}
                          </Menu.Content>
                        </Menu>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card className="items-center gap-3 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FolderLock className="size-5" /></span>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{adminMode && query ? "Kein Space gefunden" : "Noch kein privater Space"}</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                {adminMode && query ? "Versuchen Sie einen anderen Namen." : "Ein Space hält Apps privat. Mitglieder laden Sie anschließend ein."}
              </p>
            </div>
            {canCreate && !(adminMode && query) && (
              <Button variant="secondary" onClick={openCreate}><Plus />Ersten Space erstellen</Button>
            )}
          </Card>
        )}
      </section>

      {adminMode && total > 50 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">Seite {page} von {pageCount}</p>
          <Pagination count={pageCount} page={page} onPageChange={setPage} disabled={loading} />
        </div>
      )}

      {ownerSpace && (
        <SpaceOwnerModal space={ownerSpace} onOpenChange={(open) => { if (!open) setOwnerSpace(null); }} onSaved={loadSpaces} />
      )}
      {groupSpace && (
        <SpaceGroupMappingsModal key={groupSpace.id} space={groupSpace} onOpenChange={(open) => { if (!open) setGroupSpace(null); }} />
      )}
      {memberSpace && (
        <SpaceMembersModal
          key={memberSpace.id}
          space={memberSpace}
          viewerId={user.id}
          canManage={permitted(Permission.ManageSpaceMembers)}
          onOpenChange={(open) => { if (!open) setMemberSpace(null); }}
          onSaved={loadSpaces}
        />
      )}
      <SpaceFormDialog
        isOpen={createOpen}
        onOpenChange={setCreateOpen}
        title="Space erstellen"
        description="Ein privater Bereich für Apps. Mitglieder laden Sie anschließend ein."
        label="Name"
        placeholder="z. B. Projektteam"
        value={name}
        onChange={setName}
        pending={pending}
        error={error}
        submitLabel="Space erstellen"
        onSubmit={() => void act(async () => { await request("/spaces", "POST", { name }); await loadSpaces(); setCreateOpen(false); setName(""); })}
      />
      <SpaceFormDialog
        isOpen={!!editSpace}
        onOpenChange={(open) => { if (!open) setEditSpace(null); }}
        title="Space umbenennen"
        description="Der neue Name gilt für alle Mitglieder."
        label="Name"
        value={editSpace?.name || ""}
        onChange={(value) => setEditSpace((current) => (current ? { ...current, name: value } : null))}
        pending={pending}
        error={error}
        submitLabel="Speichern"
        onSubmit={() => void act(async () => {
          if (!editSpace) return;
          await request(`/spaces/${editSpace.id}`, "PATCH", { name: editSpace.name });
          await loadSpaces();
          setEditSpace(null);
        })}
      />
      <ConfirmDialog
        isOpen={!!deleteSpace}
        onOpenChange={(open) => { if (!open) setDeleteSpace(null); }}
        title="Space endgültig löschen?"
        description={`„${deleteSpace?.name || ""}“ und alle privaten Apps darin werden gelöscht, auch die anderer Mitglieder. Bereits veröffentlichte Apps bleiben erhalten.${error ? ` ${error}` : ""}`}
        confirmLabel="Space und Apps löschen"
        isDanger
        isLoading={pending}
        onConfirm={() => void act(async () => {
          if (!deleteSpace) return;
          await request(`/spaces/${deleteSpace.id}`, "DELETE");
          await loadSpaces();
          setDeleteSpace(null);
        })}
      />
    </div>
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
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!pending) onOpenChange(open); }}>
      <Dialog.Content>
        <Dialog.Header title={title} description={description} />
        <Dialog.Body className="flex flex-col gap-4">
          <form id="space-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            <Field>
              <Field.Label required>{label}</Field.Label>
              <Input required autoFocus maxLength={100} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
            </Field>
          </form>
          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
            </Alert>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" disabled={pending} />}>Abbrechen</Dialog.Close>
          <Button type="submit" form="space-form" loading={pending} disabled={!value.trim()}>{submitLabel}</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
