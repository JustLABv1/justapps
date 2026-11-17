'use client';

import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Select } from '@/components/panelui/select';
import { Tooltip } from '@/components/panelui/tooltip';
import { fetchApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface UserToken {
  id: string;
  description: string;
  type: string;
  disabled: boolean;
  created_at: string;
  expires_at?: string | null;
  key_preview: string;
}

export const LIFETIMES = [
  { value: '30', label: '30 Tage' },
  { value: '90', label: '90 Tage' },
  { value: '365', label: '1 Jahr' },
];

async function messageOf(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  return body.message || fallback;
}

/** The signed-in user's tokens, with create and revoke. */
export function useUserTokens() {
  const [tokens, setTokens] = useState<UserToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchApi('/user/tokens', { cache: 'no-store' });
      if (!response.ok) throw new Error(await messageOf(response, 'Tokens konnten nicht geladen werden.'));
      const data = await response.json() as { tokens?: UserToken[] };
      setTokens(data.tokens || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Verbindungsfehler.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  /** Returns the full token, which the server hands out only this once. */
  const create = useCallback(async (description: string, expiresInDays: number) => {
    const response = await fetchApi('/user/tokens', {
      method: 'POST',
      body: JSON.stringify({ description: description.trim(), expires_in_days: expiresInDays }),
    });
    const body = await response.json().catch(() => ({})) as { token?: string; message?: string };
    if (!response.ok || !body.token) throw new Error(body.message || 'Token konnte nicht erstellt werden.');
    void load();
    return body.token;
  }, [load]);

  const revoke = useCallback(async (id: string) => {
    const response = await fetchApi(`/user/tokens/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await messageOf(response, 'Token konnte nicht widerrufen werden.'));
    await load();
  }, [load]);

  return { tokens, loading, error, reload: load, create, revoke };
}

export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (value: string, key = 'default') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      toast.danger('Kopieren hat nicht geklappt. Bitte markiere den Text von Hand.');
    }
  }, []);
  return { copied, copy };
}

/** A value in a mono field with a copy button at its end. */
export function CopyField({ value, label, size = 'md' }: { value: string; label: string; size?: 'sm' | 'md' }) {
  const { copied, copy } = useCopy();
  return (
    <Input.Group size={size}>
      <Input readOnly value={value} aria-label={label} className="font-mono text-[13px]" onFocus={(event) => event.target.select()} />
      <Input.Addon align="end">
        <Tooltip>
          <Tooltip.Trigger
            render={<Button variant="ghost" size="icon-sm" aria-label={`${label} kopieren`} onClick={() => void copy(value)} />}
          >
            {copied ? <Check className="text-success" /> : <Copy />}
          </Tooltip.Trigger>
          <Tooltip.Content>{copied ? 'Kopiert' : 'Kopieren'}</Tooltip.Content>
        </Tooltip>
      </Input.Addon>
    </Input.Group>
  );
}

/** The new token, shown once, with the reminder that it will not be shown again. */
export function TokenReveal({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-3">
      <CopyField value={token} label="Token" />
      <Alert tone="warning" variant="plain">
        <Alert.Icon />
        <Alert.Title>Nur jetzt sichtbar</Alert.Title>
        <Alert.Description>
          Kopiere das Token jetzt. Danach zeigen wir nur noch den Anfang an – geht es verloren, erstellst du einfach ein neues.
        </Alert.Description>
      </Alert>
    </div>
  );
}

/** Name and lifetime for a new token. Calls `onCreated` with the full token. */
export function CreateTokenForm({
  create,
  onCreated,
  defaultName = 'Mein MCP-Agent',
  submitLabel = 'Token erstellen',
  id,
  hideSubmit = false,
  onPendingChange,
}: {
  create: (description: string, expiresInDays: number) => Promise<string>;
  onCreated: (token: string) => void;
  defaultName?: string;
  submitLabel?: string;
  /** Lets a button elsewhere, such as a dialog footer, submit the form. */
  id?: string;
  hideSubmit?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [lifetime, setLifetime] = useState('365');
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    onPendingChange?.(true);
    try {
      onCreated(await create(name, Number(lifetime)));
    } catch (createError) {
      toast.danger(createError instanceof Error ? createError.message : 'Token konnte nicht erstellt werden.');
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  };

  return (
    // Laid out by its own width: stacked in a narrow dialog, side by side in a page.
    <div className="@container">
    <form id={id} onSubmit={submit} className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_10rem]">
      <Field>
        <Field.Label required>Bezeichnung</Field.Label>
        <Input
          required
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          placeholder="z. B. Claude auf meinem Laptop"
        />
        <Field.Description>Woran du das Token später wiedererkennst.</Field.Description>
      </Field>
      <Field>
        <Field.Label>Gültig für</Field.Label>
        <Select items={LIFETIMES} value={lifetime} onValueChange={(value) => value && setLifetime(value)}>
          <Select.Trigger className="w-full">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {LIFETIMES.map((item) => <Select.Item key={item.value} value={item.value}>{item.label}</Select.Item>)}
          </Select.Content>
        </Select>
      </Field>
      {!hideSubmit && (
        <Button type="submit" loading={pending} disabled={!name.trim()} className="w-fit @lg:col-span-2">
          <KeyRound />
          {submitLabel}
        </Button>
      )}
    </form>
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;

export function daysUntil(date?: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / DAY);
}

export function formatDate(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}
