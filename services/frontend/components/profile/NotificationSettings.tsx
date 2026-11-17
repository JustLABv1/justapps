'use client';

import { Card } from '@/components/panelui/card';
import { Switch } from '@/components/panelui/switch';
import { useUpdates } from '@/context/UpdatesContext';
import { toast } from '@/lib/toast';
import { Bell } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';

type RuleKey = 'notifyFavoritedApps' | 'notifyRecentlyViewedApps' | 'notifyOwnedManagedApps' | 'weeklyDigest';

const RULES: { key: RuleKey; title: string; description: string }[] = [
  { key: 'notifyFavoritedApps', title: 'Favorisierte Apps', description: 'Neue Versionen von Apps, die du mit einem Herz markiert hast.' },
  { key: 'notifyRecentlyViewedApps', title: 'Kürzlich angesehene Apps', description: 'Neue Versionen von Apps, die du dir in letzter Zeit angesehen hast.' },
  { key: 'notifyOwnedManagedApps', title: 'Eigene und betreute Apps', description: 'Neue Versionen und Fragen zu Apps, die dir gehören oder die du bearbeitest.' },
];

/** What shows up in the Updates inbox. Each switch saves on its own. */
export function NotificationSettings() {
  const { preferences, updatePreferences } = useUpdates();
  const [saving, setSaving] = useState<string | null>(null);

  const change = async (key: RuleKey, value: boolean) => {
    if (!preferences) return;
    setSaving(key);
    const ok = await updatePreferences({
      notifyFavoritedApps: preferences.notifyFavoritedApps,
      notifyRecentlyViewedApps: preferences.notifyRecentlyViewedApps,
      notifyOwnedManagedApps: preferences.notifyOwnedManagedApps,
      weeklyDigest: preferences.weeklyDigest ?? false,
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
        <Card.Description>Wähle, zu welchen Apps du Benachrichtigungen erhältst. Antworten auf deine Fragen sowie Antworten und Erfüllungen deiner eigenen oder unterstützten Bedarfsmeldungen bekommst du immer.</Card.Description>
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
          {preferences?.weeklyDigestAvailable && (
            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">Wochenrückblick per E-Mail</span>
                <span className="text-xs text-muted-foreground">
                  Einmal pro Woche eine Mail mit neuen und aktualisierten Apps. Auch jederzeit unter{' '}
                  <NextLink href="/neuigkeiten" className="underline underline-offset-2 hover:text-foreground">Wochenrückblick</NextLink> zu lesen.
                </span>
              </div>
              <Switch
                label="Wochenrückblick per E-Mail"
                checked={preferences.weeklyDigest ?? false}
                pending={saving === 'weeklyDigest'}
                onCheckedChange={(value) => void change('weeklyDigest', value)}
              />
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
