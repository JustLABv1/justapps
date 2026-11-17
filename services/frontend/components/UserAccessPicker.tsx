"use client";

import { fetchApi } from "@/lib/api";
import { SystemUser } from "@/config/apps";
import { UserAvatar, authorName } from "@/components/profile/UserAvatar";
import { Badge } from "@/components/panelui/badge";
import { Input } from "@/components/panelui/input";
import { Spinner } from "@/components/panelui/spinner";
import {
  Check,
  Search,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface UserAccessPickerProps {
  users: SystemUser[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  ownerId?: string;
  lockedIds?: Set<string>;
  loading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  statusById?: Record<string, string>;
  loadingLabel?: string;
  onUserSelected?: (user: SystemUser) => void;
}

export function UserAccessPicker({
  users,
  selectedIds,
  onChange,
  ownerId,
  lockedIds,
  loading,
  disabled,
  readOnly,
  statusById,
  onUserSelected,
  loadingLabel = "Benutzer werden geladen…",
}: UserAccessPickerProps) {
  const [search, setSearch] = useState("");
  const query = search.trim();
  const [knownUsers, setKnownUsers] = useState<SystemUser[]>([]);
  const [result, setResult] = useState<{
    query: string;
    users: SystemUser[];
    hasMore: boolean;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (readOnly || query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchApi(`/users?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Benutzersuche fehlgeschlagen.");
          return response.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          const found: SystemUser[] = data.users || [];
          setKnownUsers((current) =>
            Array.from(
              new Map(
                [...current, ...found].map((user) => [user.id, user]),
              ).values(),
            ),
          );
          setResult({ query, users: found, hasMore: data.hasMore === true });
        })
        .catch((err: Error) => {
          if (!controller.signal.aborted)
            setResult({ query, users: [], hasMore: false, error: err.message });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, readOnly]);
  const selectable = Array.from(
    new Map([...knownUsers, ...users].map((user) => [user.id, user])).values(),
  ).filter((user) => !user.disabled && user.id !== ownerId);
  const selectedUsers = selectable.filter((user) => selectedIds.has(user.id));
  const currentResult = result?.query === query ? result : null;
  const searching = !readOnly && query.length >= 2 && !currentResult;
  const filtered = readOnly
    ? selectedUsers.filter((user) =>
        [user.username, user.email, user.displayName ?? ""].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : query.length >= 2
      ? (currentResult?.users || []).filter(
          (user) => !user.disabled && user.id !== ownerId,
        )
      : selectedUsers;
  const toggle = (id: string) => {
    if (lockedIds?.has(id)) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      const user = selectable.find((entry) => entry.id === id);
      if (user) onUserSelected?.(user);
    }
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant="secondary" size="lg" className="gap-1.5 ps-1 pe-1.5">
              <UserAvatar user={user} size="xs" className="size-5 text-[9px]" />
              {authorName(user)}
              {!readOnly && !lockedIds?.has(user.id) && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  aria-label={`${authorName(user)} aus Auswahl entfernen`}
                  onClick={() => toggle(user.id)}
                  className="cursor-pointer rounded-full p-0.5 opacity-70 hover:bg-foreground/10 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <Input.Group>
        <Input.Addon><Search /></Input.Addon>
        <Input
          aria-label="Benutzer suchen"
          placeholder="Name oder E-Mail-Adresse suchen"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Input.Group>
      <div className="max-h-80 divide-y overflow-y-auto rounded-xl border">
        {loading || searching ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground"
          >
            <Spinner />
            {searching ? "Benutzer werden gesucht…" : loadingLabel}
          </div>
        ) : filtered.length ? (
          filtered.map((user) => {
            const selected = selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                type="button"
                aria-pressed={selected}
                disabled={disabled || readOnly || lockedIds?.has(user.id)}
                onClick={() => toggle(user.id)}
                className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-colors disabled:cursor-default ${selected ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <UserAvatar user={user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{authorName(user)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.displayName?.trim() && user.displayName.trim() !== user.username ? `@${user.username} · ` : ""}
                    {user.email}
                  </p>
                </div>
                <Badge variant="outline" size="sm">{statusById?.[user.id] || user.authType || user.role}</Badge>
                {selected ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <UserRoundCog className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <UsersRound className="size-7 text-muted-foreground opacity-50" />
            <span className="text-sm text-muted-foreground">
              {currentResult?.error ||
                (!readOnly && query.length < 2
                  ? "Zum Einladen mindestens 2 Zeichen eines Namens oder einer E-Mail-Adresse eingeben."
                  : "Keine passenden Benutzer gefunden")}
            </span>
          </div>
        )}
      </div>
      {currentResult?.hasMore && (
        <p className="text-xs text-muted-foreground">
          Die ersten 20 Treffer werden angezeigt. Verfeinern Sie Ihre Suche.
        </p>
      )}
    </div>
  );
}
