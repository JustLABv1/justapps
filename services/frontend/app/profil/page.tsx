'use client';

import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Dialog } from '@/components/panelui/dialog';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { Spinner } from '@/components/panelui/spinner';
import { NotificationSettings } from '@/components/profile/NotificationSettings';
import { memberSince } from '@/components/profile/ProfileHeader';
import { useAuth, type User } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Heart,
  KeyRound,
  MessageCircleQuestion,
  MessagesSquare,
  Package,
  Star,
  type LucideIcon,
} from 'lucide-react';
import NextLink from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface ActivityStats {
  apps: number;
  ratings: number;
  questions: number;
  answers: number;
  favorites: number;
}

interface ActivityItem {
  type: 'app' | 'rating' | 'question' | 'answer';
  appId: string;
  appName: string;
  questionId: string;
  title: string;
  body: string;
  rating: number;
  createdAt: string | null;
}

const relative = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
function timeAgo(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'gerade eben';
}
const fullDate = (value: string) =>
  new Date(value).toLocaleString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATS: { key: keyof ActivityStats; label: string; icon: LucideIcon; href?: string }[] = [
  { key: 'apps', label: 'Apps', icon: Package, href: '/meine-apps' },
  { key: 'ratings', label: 'Bewertungen', icon: Star },
  { key: 'questions', label: 'Fragen', icon: MessageCircleQuestion },
  { key: 'answers', label: 'Antworten', icon: MessagesSquare },
  { key: 'favorites', label: 'Favoriten', icon: Heart },
];

const KIND: Record<ActivityItem['type'], { icon: LucideIcon; tint: string }> = {
  app: { icon: Package, tint: 'bg-primary/10 text-primary' },
  rating: { icon: Star, tint: 'bg-warning/15 text-warning' },
  question: { icon: MessageCircleQuestion, tint: 'bg-info/15 text-info' },
  answer: { icon: MessagesSquare, tint: 'bg-success/15 text-success' },
};

function hrefOf(item: ActivityItem) {
  if (item.type === 'app') return `/apps/${item.appId}`;
  if (item.type === 'rating') return `/apps/${item.appId}#ratings`;
  return item.appId ? `/apps/${item.appId}?frage=${item.questionId}#faq` : `/faq?frage=${item.questionId}`;
}

function sentence(item: ActivityItem): ReactNode {
  const app = <span className="font-medium text-foreground">{item.appName}</span>;
  switch (item.type) {
    case 'app':
      return <>Hat {app} angelegt</>;
    case 'rating':
      return <>Hat {app} mit {item.rating} {item.rating === 1 ? 'Stern' : 'Sternen'} bewertet</>;
    case 'question':
      return item.appId ? <>Hat eine Frage zu {app} gestellt</> : <>Hat eine Frage in der FAQ gestellt</>;
    case 'answer':
      return item.appId ? <>Hat eine Frage zu {app} beantwortet</> : <>Hat eine Frage in der FAQ beantwortet</>;
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon: Icon, tint } = KIND[item.type];
  const quote = item.type === 'question' || item.type === 'answer' ? item.title : null;
  const excerpt = item.type === 'rating' || item.type === 'answer' ? item.body : '';

  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span aria-hidden="true" className="absolute top-10 bottom-1 left-4 w-px bg-border [li:last-child>&]:hidden" />
      <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
        <p className="text-sm text-muted-foreground">
          {sentence(item)}
          {item.createdAt && (
            <>
              {' · '}
              <time dateTime={item.createdAt} title={fullDate(item.createdAt)}>{timeAgo(item.createdAt)}</time>
            </>
          )}
        </p>
        {(quote || excerpt) && (
          <NextLink
            href={hrefOf(item)}
            className="group flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {quote && <span className="line-clamp-2 font-medium group-hover:underline group-hover:underline-offset-4">{quote}</span>}
            {excerpt && <span className="line-clamp-2 text-sm text-muted-foreground">{excerpt}</span>}
          </NextLink>
        )}
        {!quote && !excerpt && (
          <NextLink href={hrefOf(item)} className="w-fit rounded text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            Ansehen
          </NextLink>
        )}
      </div>
    </li>
  );
}

function PasswordDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mismatch) return;
    setSaving(true);
    try {
      const response = await fetchApi('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: current, new_password: next, confirm_password: confirm }),
      });
      if (response.status === 401) throw new Error('Das aktuelle Passwort stimmt nicht.');
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Passwort konnte nicht geändert werden.');
      }
      toast.success('Passwort geändert.');
      setOpen(false);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : 'Passwort konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) { setCurrent(''); setNext(''); setConfirm(''); }
      }}
    >
      <Dialog.Trigger render={<Button variant="secondary" size="sm" />}>
        <KeyRound />
        Passwort ändern
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header title="Passwort ändern" description="Danach meldest du dich mit dem neuen Passwort an." />
        <Dialog.Body>
          <form id="change-password" onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <Field.Label required>Aktuelles Passwort</Field.Label>
              <Input type="password" required autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
            </Field>
            <Field>
              <Field.Label required>Neues Passwort</Field.Label>
              <Input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
              <Field.Description>Mindestens 8 Zeichen.</Field.Description>
            </Field>
            <Field invalid={mismatch}>
              <Field.Label required>Neues Passwort wiederholen</Field.Label>
              <Input type="password" required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              {mismatch && <Field.Error match>Die Passwörter stimmen nicht überein.</Field.Error>}
            </Field>
          </form>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button variant="secondary" />}>Abbrechen</Dialog.Close>
          <Button type="submit" form="change-password" loading={saving} disabled={mismatch}>Passwort ändern</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

function AccountRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

function AccountCard({ user }: { user: User }) {
  const sso = user.authType === 'oidc';
  return (
    <Card size="sm">
      <Card.Header>
        <Card.Title>Konto</Card.Title>
        {sso && <Card.Description>Name und E-Mail kommen aus deiner Anmeldung über Single Sign-on.</Card.Description>}
      </Card.Header>
      <Card.Content>
        <dl className="flex flex-col gap-3">
          <AccountRow label="Benutzername">{user.username}</AccountRow>
          <AccountRow label="E-Mail">{user.email}</AccountRow>
          <AccountRow label="Anmeldung">{sso ? 'Single Sign-on' : 'Benutzername und Passwort'}</AccountRow>
          <AccountRow label="Rolle">{user.role === 'admin' ? 'Administration' : 'Mitglied'}</AccountRow>
          {user.created_at && <AccountRow label="Dabei seit">{memberSince(user.created_at)}</AccountRow>}
          {user.lastLoginAt && <AccountRow label="Zuletzt angemeldet">{fullDate(user.lastLoginAt)}</AccountRow>}
        </dl>
      </Card.Content>
      {!sso && (
        <Card.Footer>
          <PasswordDialog />
        </Card.Footer>
      )}
    </Card>
  );
}

export default function ProfilPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    if (nextPage > 1) setLoadingMore(true);
    try {
      const response = await fetchApi(`/user/activity?page=${nextPage}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || 'Aktivität konnte nicht geladen werden.');
      }
      const data = await response.json() as { stats: ActivityStats; items: ActivityItem[]; hasMore: boolean };
      setStats(data.stats);
      setItems((previous) => (nextPage === 1 ? data.items : [...previous, ...data.items]));
      setHasMore(data.hasMore);
      setPage(nextPage);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Aktivität konnte nicht geladen werden.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // The next page loads as the end of the list comes near. The observer is made
  // again after every load, so a short page that leaves the end in view loads on.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading || loadingMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load(page + 1);
        }
      },
      { rootMargin: '0px 0px 400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [error, hasMore, load, loading, loadingMore, page]);

  if (!user) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex flex-col gap-8">
        <Card className="grid grid-cols-2 gap-0 divide-y py-0 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {STATS.map(({ key, label, icon: Icon, href }) => {
            const content = (
              <>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5" />
                  {label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {stats ? stats[key] : error ? '–' : <span className="inline-block h-7 w-8 animate-pulse rounded bg-muted align-middle" />}
                </span>
              </>
            );
            const className = 'flex flex-col gap-1 px-5 py-4';
            return href ? (
              <NextLink key={key} href={href} className={`${className} outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`}>
                {content}
              </NextLink>
            ) : (
              <div key={key} className={className}>{content}</div>
            );
          })}
        </Card>

        <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
          <h2 id="activity-heading" className="text-lg font-semibold tracking-tight">Aktivität</h2>

          {error && (
            <Alert variant="plain" tone="destructive">
              <Alert.Icon />
              <Alert.Title>{error}</Alert.Title>
              <Alert.Actions>
                <Button size="sm" variant="secondary" onClick={() => void load(1)}>Erneut versuchen</Button>
              </Alert.Actions>
            </Alert>
          )}

          {loading ? (
            <ul aria-busy="true" className="flex flex-col gap-6">
              {[0, 1, 2].map((index) => (
                <li key={index} className="flex gap-4">
                  <span className="size-8 animate-pulse rounded-full bg-muted" />
                  <span className="flex flex-1 flex-col gap-2 pt-1">
                    <span className="h-4 w-56 animate-pulse rounded bg-muted" />
                    <span className="h-14 animate-pulse rounded-xl bg-muted" />
                  </span>
                </li>
              ))}
            </ul>
          ) : items.length === 0 && !error ? (
            <Card className="items-center gap-2 px-6 py-12 text-center">
              <p className="font-medium">Noch nichts los</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Hier erscheint, was du im Katalog machst: Apps anlegen, bewerten, Fragen stellen und beantworten.
              </p>
              <Button variant="secondary" size="sm" className="mt-2" render={<NextLink href="/" />}>Apps entdecken</Button>
            </Card>
          ) : (
            <>
              <ol>
                {items.map((item, index) => (
                  <ActivityRow key={`${item.type}-${item.questionId || item.appId}-${item.createdAt}-${index}`} item={item} />
                ))}
              </ol>
              {hasMore && (
                <div ref={sentinel} role="status" className="flex justify-center py-2 text-sm text-muted-foreground">
                  {loadingMore ? (
                    <span className="flex items-center gap-2"><Spinner />Ältere Aktivität wird geladen…</span>
                  ) : error ? null : (
                    // Reached by keyboard, or when the observer is not available.
                    <Button variant="ghost" size="sm" onClick={() => void load(page + 1)}>Ältere Aktivität laden</Button>
                  )}
                </div>
              )}
              {!hasMore && page > 1 && (
                <p className="text-center text-xs text-muted-foreground">Das ist alles – weiter zurück geht es nicht.</p>
              )}
            </>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <AccountCard user={user} />
        <NotificationSettings />
      </aside>
    </div>
  );
}
