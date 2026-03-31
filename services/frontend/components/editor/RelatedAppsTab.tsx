'use client';

import { AppConfig } from '@/config/apps';
import { Button, Chip, Input, Switch } from '@heroui/react';
import { Grip, Link2, Loader2, Plus, X } from 'lucide-react';
import Image from 'next/image';

interface RelatedApp {
  id: string;
  name: string;
  icon?: string;
}

interface AppGroup {
  id: string;
  name: string;
  description?: string;
}

interface RelatedAppsTabProps {
  isNew: boolean;
  isAdmin: boolean;
  relatedApps: RelatedApp[];
  groups: AppGroup[];
  appGroupIds: Set<string>;
  relatedSearch: string;
  setRelatedSearch: (v: string) => void;
  filteredRelatable: AppConfig[];
  addingRelated: boolean;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  creatingGroup: boolean;
  onAddRelated: (app: AppConfig) => void;
  onRemoveRelated: (id: string) => void;
  onToggleGroup: (groupId: string) => void;
  onCreateGroup: () => void;
}

export function RelatedAppsTab({
  isNew, isAdmin, relatedApps, groups, appGroupIds,
  relatedSearch, setRelatedSearch, filteredRelatable, addingRelated,
  newGroupName, setNewGroupName, creatingGroup,
  onAddRelated, onRemoveRelated, onToggleGroup, onCreateGroup,
}: RelatedAppsTabProps) {
  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center">
          <Link2 className="w-6 h-6 text-muted" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">App zuerst speichern</p>
          <p className="text-xs text-muted mt-1">Verknüpfte Apps und Gruppen können nach dem ersten Speichern eingerichtet werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Current group memberships */}
      {isAdmin && appGroupIds.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.filter(g => appGroupIds.has(g.id)).map(g => (
            <Chip key={g.id} size="sm" variant="soft" color="accent" className="text-xs font-semibold">
              {g.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Current related apps grid */}
      {relatedApps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {relatedApps.map(related => (
            <div
              key={related.id}
              className="flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/40 hover:bg-surface transition-all shadow-sm group"
            >
              <div className="w-10 h-10 rounded-xl bg-surface border border-border shadow-sm flex items-center justify-center text-xl shrink-0 overflow-hidden">
                {related.icon?.startsWith('http') ? (
                  <Image src={related.icon} alt={related.name} width={40} height={40} className="object-contain p-1" unoptimized />
                ) : (
                  related.icon || '🏛️'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-accent transition-colors">{related.name}</p>
                <p className="text-xs text-muted flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> {related.id}
                </p>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="danger-soft"
                onPress={() => onRemoveRelated(related.id)}
                aria-label={`${related.name} entfernen`}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search and add related apps */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-muted uppercase tracking-wider">App suchen und verknüpfen</span>
        <Input
          className="w-full"
          placeholder="App-Name oder ID suchen..."
          value={relatedSearch}
          variant="secondary"
          onChange={(e) => setRelatedSearch(e.target.value)}
        />
        {relatedSearch && (
          <div className="border border-border rounded-xl bg-surface overflow-hidden max-h-64 overflow-y-auto">
            {filteredRelatable.slice(0, 10).map((a) => (
              <Button
                key={a.id}
                fullWidth
                variant="ghost"
                onPress={() => onAddRelated(a)}
                className="h-auto justify-start rounded-none border-b border-border/50 px-3 py-3 text-left last:border-0"
              >
                <span className="text-xl shrink-0">{a.icon?.startsWith('http') ? '🏛️' : a.icon || '🏛️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted">{a.categories?.join(', ')}</p>
                </div>
                {addingRelated ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-accent shrink-0" />
                )}
              </Button>
            ))}
            {filteredRelatable.length === 0 && (
              <p className="p-4 text-sm text-muted text-center">Keine weiteren Apps gefunden</p>
            )}
          </div>
        )}
      </div>

      {/* Groups management (admin only) */}
      {isAdmin && (
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Grip className="w-4 h-4 text-accent" />
            <span className="text-sm font-bold text-foreground">Gruppen</span>
          </div>
          <p className="text-xs text-muted">Ordnen Sie diese App einer oder mehreren Gruppen zu.</p>
          <div className="space-y-2">
            {groups.map((group) => {
              const inGroup = appGroupIds.has(group.id);
              return (
                <div
                  key={group.id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    inGroup ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    {group.description && <p className="text-xs text-muted">{group.description}</p>}
                  </div>
                  <Switch isSelected={inGroup} onChange={() => onToggleGroup(group.id)}>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch>
                </div>
              );
            })}
            {groups.length === 0 && (
              <p className="text-sm text-muted text-center py-4 bg-surface rounded-xl border border-dashed border-border/60">
                Noch keine Gruppen erstellt.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="Neue Gruppe erstellen..."
              value={newGroupName}
              variant="secondary"
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCreateGroup(); }}
            />
            <Button
              onPress={onCreateGroup}
              isDisabled={!newGroupName.trim() || creatingGroup}
              isPending={creatingGroup}
              className="gap-1.5"
            >
              {!creatingGroup ? <Plus className="w-4 h-4" /> : null}
              Erstellen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
