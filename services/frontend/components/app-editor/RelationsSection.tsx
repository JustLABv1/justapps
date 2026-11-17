"use client";

import { Button } from "@/components/panelui/button";
import { Combobox } from "@/components/panelui/combobox";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import type { AppConfig } from "@/config/apps";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { AppIcon } from "./BasicsSection";
import { EditorCard, SettingRow } from "./shared";

export interface RelatedApp {
  id: string;
  name: string;
  icon?: string;
}

export interface AppGroup {
  id: string;
  name: string;
  description?: string;
}

export function RelationsSection({
  appId,
  existingApps,
  relatedApps,
  onRelatedChange,
  canManageGroups,
  groups,
  groupIds,
  onToggleGroup,
  onCreateGroup,
}: {
  appId: string;
  existingApps: AppConfig[];
  relatedApps: RelatedApp[];
  onRelatedChange: (apps: RelatedApp[]) => void;
  canManageGroups: boolean;
  groups: AppGroup[];
  groupIds: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const candidates = existingApps.filter((app) => app.id !== appId && !relatedApps.some((related) => related.id === app.id));

  const createGroup = () => {
    if (!newGroup.trim()) return;
    onCreateGroup(newGroup.trim());
    setNewGroup("");
  };

  return (
    <>
      <EditorCard title="Verwandte Apps" description="Erscheinen auf der Detailseite als passende Ergänzungen oder Alternativen.">
        <Combobox
          value={undefined}
          inputValue={query}
          onInputValueChange={setQuery}
          onValueChange={(id) => {
            const app = existingApps.find((item) => item.id === id);
            if (app) onRelatedChange([...relatedApps, { id: app.id, name: app.name, icon: app.icon }]);
            setQuery("");
          }}
          placeholder="App suchen und verknüpfen"
          accessibilityLabel="App suchen und verknüpfen"
          emptyMessage="Keine passende App"
        >
          {candidates.map((app) => (
            <Combobox.Item key={app.id} value={app.id} label={app.name} description={app.id} start={<AppIcon icon={app.icon} size="sm" />} />
          ))}
        </Combobox>
        {relatedApps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine verwandten Apps.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {relatedApps.map((app) => (
              <li key={app.id} className="flex items-center gap-3 px-3 py-2">
                <AppIcon icon={app.icon} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{app.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${app.name} entfernen`}
                  onClick={() => onRelatedChange(relatedApps.filter((item) => item.id !== app.id))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </EditorCard>

      {canManageGroups && (
        <EditorCard
          title="Gruppen"
          description="Gruppen bündeln Apps zu Themen oder Programmen und erscheinen als eigener Filter im Katalog."
          footer={
            <form
              className="flex w-full gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                createGroup();
              }}
            >
              <Input aria-label="Neue Gruppe" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="Neue Gruppe anlegen" />
              <Button type="submit" variant="outline" disabled={!newGroup.trim()}>
                <Plus />
                Anlegen
              </Button>
            </form>
          }
        >
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Es gibt noch keine Gruppen.</p>
          ) : (
            groups.map((group) => (
              <SettingRow
                key={group.id}
                title={group.id.startsWith("pending:") ? `${group.name} (neu)` : group.name}
                description={group.description || "Ohne Beschreibung"}
                control={<Switch label={`Zur Gruppe ${group.name}`} checked={groupIds.has(group.id)} onCheckedChange={() => onToggleGroup(group.id)} />}
              />
            ))
          )}
        </EditorCard>
      )}
    </>
  );
}
