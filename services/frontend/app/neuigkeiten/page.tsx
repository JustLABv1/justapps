'use client';

import { AppStoreGate } from '@/components/AppStoreGate';
import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { useAuth } from '@/context/AuthContext';
import { useUpdates } from '@/context/UpdatesContext';
import { fetchApi } from '@/lib/api';
import { getImageAssetUrl } from '@/lib/assets';
import { Activity, BookOpen, ChevronLeft, ChevronRight, Cpu, Image as ImageIcon, Link2, ListChecks, Mail, MessageCircleQuestion, PencilLine, Recycle, Scale, Server, Sparkles, Star, Tags } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

interface DigestApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  categories: string[] | null;
  at: string;
  releaseTitle?: string;
  releaseSummary?: string;
  version?: string;
  changedAreas?: string[] | null;
  fields?: string[] | null;
  versionBefore?: string;
  note?: string;
  changelog?: string;
}

interface DigestQuestion {
  id: string;
  appId: string;
  appName: string;
  appIcon: string;
  question: string;
  answers: number;
  createdAt: string;
}

interface Digest {
  week: string;
  label: string;
  previous: string;
  next?: string;
  current: boolean;
  newApps: DigestApp[];
  updatedApps: DigestApp[];
  questions: DigestQuestion[] | null;
  community: { questions: number; answers: number; ratings: number };
  totalApps: number;
}

/** What was edited, as a reader would name it. Version and changelog are shown on their own. */
const PARTS: Record<string, { label: string; icon: ReactNode }> = {
  name: { label: 'Name', icon: <PencilLine /> },
  description: { label: 'Beschreibung', icon: <PencilLine /> },
  icon: { label: 'Symbol', icon: <ImageIcon /> },
  docs: { label: 'Dokumentation', icon: <BookOpen /> },
  installation: { label: 'Installation', icon: <Server /> },
  links: { label: 'Links', icon: <Link2 /> },
  categories: { label: 'Kategorien und Tags', icon: <Tags /> },
  techStack: { label: 'Technologien', icon: <Cpu /> },
  license: { label: 'Lizenz', icon: <Scale /> },
  status: { label: 'Status', icon: <Activity /> },
  details: { label: 'Fachliche Details', icon: <ListChecks /> },
  reuse: { label: 'Nachnutzung', icon: <Recycle /> },
};

/** Release notes from the repository sync name areas; map them onto the same parts. */
const AREA_PARTS: Record<string, string> = { docs: 'docs', deployment: 'installation', metadata: 'description' };

function partsOf(app: DigestApp) {
  const keys = [...(app.fields ?? []), ...(app.changedAreas ?? []).map((area) => AREA_PARTS[area])];
  return [...new Set(keys)].filter((key) => key && PARTS[key]);
}

function joinGerman(items: string[]) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}

const dayHeading = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

/* ISO weeks, for the archive in the sidebar. */
function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const num = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { key: `${d.getUTCFullYear()}-W${String(num).padStart(2, '0')}`, num };
}

function weekStart(key: string) {
  const [year, num] = key.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (num - 1) * 7);
  return monday;
}

const shortDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

function archiveWeeks(count: number) {
  const weeks: { key: string; label: string; range: string }[] = [];
  const cursor = new Date();
  for (let i = 0; i < count; i++) {
    const { key, num } = isoWeek(cursor);
    const start = weekStart(key);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({ key, label: i === 0 ? 'Diese Woche' : i === 1 ? 'Letzte Woche' : `KW ${num}`, range: `${shortDate.format(start)} – ${shortDate.format(end)}` });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

function AppIcon({ icon, size = 'md' }: { icon: string; size?: 'md' | 'lg' }) {
  const src = getImageAssetUrl(icon);
  const box = size === 'lg' ? 'size-12 rounded-xl text-2xl' : 'size-9 rounded-lg text-lg';
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-muted ${box}`}>
      {src ? <Image src={src} alt="" fill sizes="48px" className="object-contain p-1.5" unoptimized /> : icon || '🏛️'}
    </span>
  );
}

function Figure({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.07]">
      <span className={`text-3xl font-semibold tabular-nums tracking-tight ${value > 0 ? tone : 'text-muted-foreground/60'}`}>{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionTitle({ icon, children, count }: { icon: ReactNode; children: ReactNode; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight [&_svg]:size-4 [&_svg]:text-muted-foreground">
      {icon}
      {children}
      <span className="text-sm font-normal text-muted-foreground">{count}</span>
    </h2>
  );
}

function NewAppCard({ app }: { app: DigestApp }) {
  return (
    <NextLink
      href={`/apps/${encodeURIComponent(app.id)}`}
      className="group flex h-full flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.07] outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <AppIcon icon={app.icon} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-semibold">{app.name}</span>
          <div className="flex flex-wrap gap-1">
            {(app.categories ?? []).slice(0, 2).map((category) => <Badge key={category} variant="secondary" size="sm">{category}</Badge>)}
          </div>
        </div>
        <Badge variant="success" size="sm" className="shrink-0">Neu</Badge>
      </div>
      {app.description && <p className="line-clamp-3 text-sm text-muted-foreground">{app.description}</p>}
    </NextLink>
  );
}

function UpdatedAppRow({ app }: { app: DigestApp }) {
  const parts = partsOf(app);
  const headline = app.note || app.releaseSummary || (parts.length ? `${joinGerman(parts.map((key) => PARTS[key].label))} überarbeitet` : app.releaseTitle || '');
  const versionMoved = app.versionBefore && app.version && app.versionBefore !== app.version;
  return (
    <NextLink
      href={`/apps/${encodeURIComponent(app.id)}`}
      className="flex items-start gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
    >
      <AppIcon icon={app.icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{app.name}</span>
          {versionMoved ? (
            <Badge variant="info" size="sm">{app.versionBefore} → {app.version}</Badge>
          ) : app.version ? (
            <Badge variant="outline" size="sm">{app.version}</Badge>
          ) : null}
        </span>
        {headline && <span className="text-sm text-foreground/90">{headline}</span>}
        {app.changelog && (
          <span className="line-clamp-4 whitespace-pre-line rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{app.changelog}</span>
        )}
        {parts.length > 0 && (app.note || app.releaseSummary) && (
          <span className="flex flex-wrap gap-1.5">
            {parts.map((key) => (
              <Badge key={key} variant="secondary" size="sm">
                {PARTS[key].icon}
                {PARTS[key].label}
              </Badge>
            ))}
          </span>
        )}
      </span>
    </NextLink>
  );
}

function DigestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = searchParams.get('woche') ?? '';
  const { user } = useAuth();
  const { preferences } = useUpdates();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [archive, setArchive] = useState<ReturnType<typeof archiveWeeks>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setArchive(archiveWeeks(8)), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let active = true;
    const id = window.setTimeout(() => {
      setLoading(true);
      fetchApi(week ? `/digest?week=${encodeURIComponent(week)}` : '/digest', { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error((data as { message?: string }).message || 'Der Wochenrückblick konnte nicht geladen werden.');
          return data as Digest;
        })
        .then((data) => { if (active) { setDigest(data); setError(''); } })
        .catch((err: Error) => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(id); };
  }, [week]);

  const goTo = (target?: string) => router.push(target ? `/neuigkeiten?woche=${target}` : '/neuigkeiten', { scroll: false });
  const questions = digest?.questions ?? [];
  const community = digest?.community ?? { questions: 0, answers: 0, ratings: 0 };
  const nothing = digest && digest.newApps.length === 0 && digest.updatedApps.length === 0 && questions.length === 0;

  // The week's changes, grouped by the day they happened.
  const byDay = new Map<string, DigestApp[]>();
  for (const app of digest?.updatedApps ?? []) {
    const day = dayHeading.format(new Date(app.at));
    byDay.set(day, [...(byDay.get(day) ?? []), app]);
  }

  const summary = digest
    ? [
        digest.newApps.length > 0 && `${digest.newApps.length} ${digest.newApps.length === 1 ? 'neue App' : 'neue Apps'}`,
        digest.updatedApps.length > 0 && `${digest.updatedApps.length} ${digest.updatedApps.length === 1 ? 'Aktualisierung' : 'Aktualisierungen'}`,
        community.questions > 0 && `${community.questions} ${community.questions === 1 ? 'neue Frage' : 'neue Fragen'}`,
      ].filter(Boolean).join(', ')
    : '';

  const currentKey = digest?.week;

  return (
    <div className="flex flex-col gap-8 pb-16">
      <header className="flex flex-col gap-5 pt-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4" />
            Wochenrückblick{digest?.current ? ' · diese Woche bisher' : ''}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{digest?.label ?? 'Neuigkeiten'}</h1>
          <p className="text-base text-pretty text-muted-foreground sm:text-lg">
            {digest
              ? summary
                ? `${digest.current ? 'Bisher diese Woche' : 'In dieser Woche'}: ${summary}.`
                : 'Was im Katalog neu ist und was sich geändert hat.'
              : 'Was im Katalog neu ist und was sich geändert hat.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Vorherige Woche" disabled={!digest} onClick={() => digest && goTo(digest.previous)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" aria-label="Nächste Woche" disabled={!digest?.next} onClick={() => digest?.next && goTo(digest.next)}>
            <ChevronRight />
          </Button>
          {digest && !digest.current && <Button variant="ghost" onClick={() => goTo()}>Diese Woche</Button>}
        </div>
      </header>

      {error && (
        <Alert variant="plain" tone="destructive">
          <Alert.Icon />
          <Alert.Title>{error}</Alert.Title>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className={`flex min-w-0 flex-col gap-10 transition-opacity ${loading && digest ? 'opacity-60' : ''}`}>
          {loading && !digest ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
              {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : digest && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Figure value={digest.newApps.length} label="Neue Apps" tone="text-success" />
                <Figure value={digest.updatedApps.length} label="Aktualisiert" tone="text-info" />
                <Figure value={community.questions} label="Neue Fragen" tone="text-warning" />
                <Figure value={community.ratings} label="Bewertungen" tone="text-foreground" />
              </div>

              {nothing && (
                <Card>
                  <Card.Content className="flex flex-col items-center gap-1 py-12 text-center">
                    <p className="font-medium">{digest.current ? 'Diese Woche ist noch nichts Neues dazugekommen.' : 'In dieser Woche gab es keine Neuigkeiten.'}</p>
                    <p className="text-sm text-muted-foreground">Der Katalog umfasst {digest.totalApps} Apps. Ein Blick in eine frühere Woche?</p>
                  </Card.Content>
                </Card>
              )}

              {digest.newApps.length > 0 && (
                <section className="flex flex-col gap-4" aria-label="Neu im Katalog">
                  <SectionTitle icon={<Sparkles />} count={digest.newApps.length}>Neu im Katalog</SectionTitle>
                  <div className="grid gap-3 md:grid-cols-2">
                    {digest.newApps.map((app) => <NewAppCard key={app.id} app={app} />)}
                  </div>
                </section>
              )}

              {byDay.size > 0 && (
                <section className="flex flex-col gap-4" aria-label="Aktualisiert">
                  <SectionTitle icon={<Server />} count={digest.updatedApps.length}>Aktualisiert</SectionTitle>
                  <ol className="flex flex-col gap-6 border-s ps-5">
                    {[...byDay.entries()].map(([day, apps]) => (
                      <li key={day} className="relative flex flex-col gap-1">
                        <span aria-hidden="true" className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-info ring-4 ring-background" />
                        <h3 className="text-sm font-medium text-muted-foreground">{day}</h3>
                        <div className="-mx-3 flex flex-col">
                          {apps.map((app) => <UpdatedAppRow key={app.id} app={app} />)}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {questions.length > 0 && (
                <section className="flex flex-col gap-4" aria-label="Neue Fragen">
                  <SectionTitle icon={<MessageCircleQuestion />} count={community.questions}>Neue Fragen</SectionTitle>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {questions.map((question) => (
                      <li key={question.id}>
                        <NextLink
                          href={`/apps/${encodeURIComponent(question.appId)}#faq`}
                          className="flex h-full flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.07] outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="line-clamp-3 text-pretty">„{question.question}“</p>
                          <span className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                            <AppIcon icon={question.appIcon} />
                            <span className="min-w-0 flex-1 truncate">{question.appName}</span>
                            <Badge variant={question.answers > 0 ? 'secondary' : 'warning'} size="sm">
                              {question.answers > 0 ? `${question.answers} ${question.answers === 1 ? 'Antwort' : 'Antworten'}` : 'Offen'}
                            </Badge>
                          </span>
                        </NextLink>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {user && preferences?.weeklyDigestAvailable && (
            <Card size="sm">
              <Card.Header>
                <Card.Title className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />Per E-Mail</Card.Title>
                <Card.Description>
                  {preferences.weeklyDigest ? 'Du bekommst den Rückblick jede Woche ins Postfach.' : 'Den Rückblick einmal pro Woche ins Postfach bekommen.'}
                </Card.Description>
              </Card.Header>
              <Card.Footer>
                <Button size="sm" variant={preferences.weeklyDigest ? 'ghost' : 'default'} className="w-full" render={<NextLink href="/profil#benachrichtigungen" />}>
                  {preferences.weeklyDigest ? 'Einstellungen' : 'Abonnieren'}
                </Button>
              </Card.Footer>
            </Card>
          )}

          <Card size="sm" className="gap-0 py-0">
            <Card.Header className="py-4">
              <Card.Title>Archiv</Card.Title>
            </Card.Header>
            <nav aria-label="Frühere Wochen" className="flex flex-col p-1.5 pt-0">
              {archive.map((item) => {
                const active = item.key === currentKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => goTo(item.label === 'Diese Woche' ? undefined : item.key)}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.range}</span>
                  </button>
                );
              })}
            </nav>
          </Card>

          {digest && (
            <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Star className="size-4" />
              {digest.totalApps} Apps im Katalog
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function NewsPage() {
  return (
    <AppStoreGate>
      <Suspense fallback={null}>
        <DigestContent />
      </Suspense>
    </AppStoreGate>
  );
}
