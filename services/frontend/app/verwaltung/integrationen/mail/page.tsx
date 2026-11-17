'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Select } from '@/components/panelui/select';
import { Switch } from '@/components/panelui/switch';
import { fetchApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { ExternalLink, Mail, Send } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: 'starttls' | 'tls' | 'none';
  username: string;
  fromAddress: string;
  fromName: string;
  siteUrl: string;
  digestEnabled: boolean;
  digestWeekday: number;
  digestHour: number;
  lastDigestWeek: string;
  lastDigestSentAt: string | null;
  lastDigestRecipients: number;
  passwordConfigured: boolean;
}

const SECURITY = [
  { value: 'starttls', label: 'STARTTLS (meist Port 587)' },
  { value: 'tls', label: 'TLS (meist Port 465)' },
  { value: 'none', label: 'Unverschlüsselt (nur intern)' },
];

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((label, index) => ({ value: String(index + 1), label }));
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: `${String(hour).padStart(2, '0')}:00 Uhr` }));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { message?: string }).message || 'Die Anfrage ist fehlgeschlagen.');
  return data as T;
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch label={title} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function MailSettingsPage() {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    request<MailSettings>('/settings/mail')
      .then((data) => {
        if (!active) return;
        setSettings({ ...data, siteUrl: data.siteUrl || window.location.origin });
      })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  if (!settings) {
    return error ? (
      <Alert variant="plain" tone="destructive"><Alert.Icon /><Alert.Title>{error}</Alert.Title></Alert>
    ) : (
      <p role="status" className="py-16 text-center text-sm text-muted-foreground">E-Mail-Einstellungen werden geladen …</p>
    );
  }

  const patch = (next: Partial<MailSettings>) => setSettings({ ...settings, ...next });

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await request<MailSettings>('/settings/mail', {
        method: 'PUT',
        body: JSON.stringify({ ...settings, password }),
      });
      setSettings(saved);
      setPassword('');
      toast.success('E-Mail-Einstellungen gespeichert.');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Test and send use what is stored, so unsaved changes are saved first.
  const sendTest = async () => {
    if (!(await save())) return;
    setTesting(true);
    try {
      const result = await request<{ to: string }>('/settings/mail/test', { method: 'POST' });
      toast.success(`Test-Mail an ${result.to} gesendet.`);
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Die Test-Mail konnte nicht gesendet werden.');
    } finally {
      setTesting(false);
    }
  };

  const sendDigest = async () => {
    if (!(await save())) return;
    setSending(true);
    try {
      const result = await request<{ week: string; recipients: number; failed: number }>('/settings/mail/digest', { method: 'POST' });
      toast.success(`Wochenrückblick ${result.week} an ${result.recipients} ${result.recipients === 1 ? 'Person' : 'Personen'} gesendet${result.failed ? `, ${result.failed} fehlgeschlagen` : ''}.`);
      setSettings({ ...settings, lastDigestWeek: result.week, lastDigestRecipients: result.recipients, lastDigestSentAt: new Date().toISOString() });
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Der Wochenrückblick konnte nicht versendet werden.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">E-Mail &amp; Wochenrückblick</h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Der SMTP-Server, über den JustApps Mails verschickt, und der wöchentliche Rückblick für alle, die ihn im Profil abonniert haben.
        </p>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      <Card className="@container">
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            SMTP-Server
            <Badge variant={settings.enabled ? 'success' : 'secondary'} size="sm">{settings.enabled ? 'Aktiv' : 'Aus'}</Badge>
          </Card.Title>
          <Card.Description>Das Passwort wird verschlüsselt gespeichert und nicht wieder angezeigt.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <ToggleRow title="E-Mail-Versand aktivieren" description="Ohne diesen Schalter verschickt JustApps keine Mails." checked={settings.enabled} onChange={(enabled) => patch({ enabled })} />
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,14rem)]">
            <Field>
              <Field.Label>Server</Field.Label>
              <Input className="font-mono text-sm" value={settings.host} placeholder="smtp.example.org" onChange={(event) => patch({ host: event.target.value })} />
            </Field>
            <Field>
              <Field.Label>Port</Field.Label>
              <Input className="font-mono text-sm" inputMode="numeric" value={String(settings.port)} onChange={(event) => patch({ port: Number.parseInt(event.target.value, 10) || 0 })} />
            </Field>
            <Field>
              <Field.Label>Verschlüsselung</Field.Label>
              <Select items={SECURITY} value={settings.security} onValueChange={(value) => patch({ security: value as MailSettings['security'], port: value === 'tls' ? 465 : value === 'starttls' && settings.port === 465 ? 587 : settings.port })}>
                <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                <Select.Content>{SECURITY.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            <Field>
              <Field.Label>Benutzername</Field.Label>
              <Input autoComplete="off" value={settings.username} placeholder="optional" onChange={(event) => patch({ username: event.target.value })} />
            </Field>
            <Field>
              <Field.Label>Passwort</Field.Label>
              <Input type="password" autoComplete="new-password" value={password} placeholder={settings.passwordConfigured ? 'Gespeichert – zum Ändern neu eingeben' : 'optional'} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field>
              <Field.Label>Absenderadresse</Field.Label>
              <Input type="email" value={settings.fromAddress} placeholder="noreply@example.org" onChange={(event) => patch({ fromAddress: event.target.value })} />
            </Field>
            <Field>
              <Field.Label>Absendername</Field.Label>
              <Input value={settings.fromName} placeholder="JustApps" onChange={(event) => patch({ fromName: event.target.value })} />
            </Field>
          </div>
        </Card.Content>
        <Card.Footer className="flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" loading={testing} disabled={!settings.enabled} onClick={() => void sendTest()}>
            <Send />
            Test-Mail an mich
          </Button>
          <Button type="submit" loading={saving}>Speichern</Button>
        </Card.Footer>
      </Card>

      <Card className="@container">
        <Card.Header>
          <Card.Title>Wochenrückblick</Card.Title>
          <Card.Description>
            Eine Mail mit den neuen und aktualisierten Apps der vergangenen Woche an alle, die sie im Profil abonniert haben. Die gleiche Zusammenfassung steht jederzeit unter{' '}
            <NextLink href="/neuigkeiten" className="underline underline-offset-2 hover:text-foreground">Wochenrückblick</NextLink>.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <ToggleRow title="Wöchentlich versenden" description="Wochen ohne neue oder geänderte Apps werden übersprungen." checked={settings.digestEnabled} onChange={(digestEnabled) => patch({ digestEnabled })} />
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
            <Field>
              <Field.Label>Adresse der Plattform</Field.Label>
              <Input className="font-mono text-sm" value={settings.siteUrl} placeholder="https://apps.example.org" onChange={(event) => patch({ siteUrl: event.target.value })} />
              <Field.Description>Für die Links in der Mail.</Field.Description>
            </Field>
            <Field>
              <Field.Label>Versandtag</Field.Label>
              <Select items={WEEKDAYS} value={String(settings.digestWeekday)} onValueChange={(value) => patch({ digestWeekday: Number(value) })}>
                <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                <Select.Content>{WEEKDAYS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
              </Select>
            </Field>
            <Field>
              <Field.Label>Uhrzeit</Field.Label>
              <Select items={HOURS} value={String(settings.digestHour)} onValueChange={(value) => patch({ digestHour: Number(value) })}>
                <Select.Trigger className="w-full"><Select.Value /></Select.Trigger>
                <Select.Content>{HOURS.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}</Select.Content>
              </Select>
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">
            {settings.lastDigestSentAt
              ? `Zuletzt versendet: ${settings.lastDigestWeek} am ${new Date(settings.lastDigestSentAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} an ${settings.lastDigestRecipients} ${settings.lastDigestRecipients === 1 ? 'Person' : 'Personen'}.`
              : 'Bisher wurde noch kein Wochenrückblick versendet.'}
          </p>
        </Card.Content>
        <Card.Footer className="flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" loading={sending} disabled={!settings.enabled} onClick={() => void sendDigest()}>
              <Send />
              Letzte Woche jetzt senden
            </Button>
            <Button type="button" variant="ghost" render={<NextLink href="/neuigkeiten" target="_blank" />}>
              Vorschau
              <ExternalLink />
            </Button>
          </div>
          <Button type="submit" loading={saving}>Speichern</Button>
        </Card.Footer>
      </Card>
    </form>
  );
}
