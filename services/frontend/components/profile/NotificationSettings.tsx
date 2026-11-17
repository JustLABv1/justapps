'use client';

import { Card } from '@/components/panelui/card';
import { Switch } from '@/components/panelui/switch';
import { useUpdates } from '@/context/UpdatesContext';
import { toast } from '@/lib/toast';
import { Bell } from 'lucide-react';
import { useState } from 'react';

const RULES = [
  { key: 'notifyFavoritedApps', title: 'Favorisierte Apps', description: 'Neue Versionen von Apps, die du mit einem Herz markiert hast.' },
  { key: 'notifyRecentlyViewedApps', title: 'Kürzlich angesehene Apps', description: 'Neue Versionen von Apps, die du dir in letzter Zeit angesehen hast.' },
  { key: 'notifyOwnedManagedApps', title: 'Eigene und betreute Apps', description: 'Neue Versionen und Fragen zu Apps, die dir gehören oder die du bearbeitest.' },
] as const;

/** What shows up in the Updates inbox. Each switch saves on its own. */
export function NotificationSettings() {
  const { preferences, updatePreferences } = useUpdates();
  const [saving, setSaving] = useState<string | null>(null);

  const change = async (key: (typeof RULES)[number]['key'], value: boolean) => {
    if (!preferences) return;
    setSaving(key);
    const ok = await updatePreferences({
      notifyFavoritedApps: preferences.notifyFavoritedApps,
      notifyRecentlyViewedApps: preferences.notifyRecentlyViewedApps,
      notifyOwnedManagedApps: preferences.notifyOwnedManagedApps,
      [key]: value,
    });
    setSaving(null);
    if (!ok) toast.danger('Die Einstellung konnte nicht gespeichert werden.');
  };

  return (
    <Card size="sm" id="benachrichtigungen" className="scroll-mt-24">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          Benachrichtigungen
        </Card.Title>
        <Card.Description>Worüber dich die Updates informieren. Antworten auf deine eigenen Fragen bekommst du immer.</Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="flex flex-col gap-4">
          {RULES.map((rule) => (
            <div key={rule.key} className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{rule.title}</span>
                <span className="text-xs text-muted-foreground">{rule.description}</span>
              </div>
              <Switch
                label={rule.title}
                checked={preferences?.[rule.key] ?? true}
                disabled={!preferences}
                pending={saving === rule.key}
                onCheckedChange={(value) => void change(rule.key, value)}
              />
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}
