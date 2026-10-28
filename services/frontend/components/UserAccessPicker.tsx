"use client";

import { fetchApi } from "@/lib/api";
import { SystemUser } from "@/config/apps";
import { Chip, EmptyState, Input } from "@heroui/react";
import {
  Check,
  Loader2,
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
        [user.username, user.email].some((value) =>
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
    <div className="space-y-5">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <Chip
              key={user.id}
              size="sm"
              variant="soft"
              color="accent"
              className="gap-1 text-xs font-semibold"
            >
              {user.username}
              {!readOnly && !lockedIds?.has(user.id) && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  aria-label={`${user.username} aus Auswahl entfernen`}
                  onClick={() => toggle(user.id)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Chip>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          aria-label="Benutzer suchen"
          className="w-full pl-9"
          placeholder="Benutzer suchen..."
          value={search}
          variant="secondary"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="max-h-80 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-surface">
        {loading || searching ? (
          <div
            role="status"
            className="flex items-center justify-center gap-3 p-8 text-sm text-muted"
          >
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
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
                className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${selected ? "bg-accent/10 text-accent" : "hover:bg-surface-secondary"}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected ? "bg-accent text-white" : "bg-surface-secondary text-muted"}`}
                >
                  {user.username[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user.username}
                  </p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {statusById?.[user.id] || user.authType || user.role}
                </span>
                {selected ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <UserRoundCog className="h-4 w-4 shrink-0 text-muted" />
                )}
              </button>
            );
          })
        ) : (
          <EmptyState className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <UsersRound className="h-8 w-8 text-muted opacity-50" />
            <span className="text-sm text-muted">
              {currentResult?.error ||
                (!readOnly && query.length < 2
                  ? "Zum Einladen mindestens 2 Zeichen eines Namens oder einer E-Mail-Adresse eingeben."
                  : "Keine passenden Benutzer gefunden")}
            </span>
          </EmptyState>
        )}
      </div>
      {currentResult?.hasMore && (
        <p className="text-xs text-muted">
          Die ersten 20 Treffer werden angezeigt. Verfeinern Sie Ihre Suche.
        </p>
      )}
    </div>
  );
}
