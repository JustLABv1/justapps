'use client';

import type { AppConfig } from '@/config/apps';
import { JustAppsLogo } from '@/components/JustAppsLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useSettings } from '@/context/SettingsContext';
import { fetchApi } from '@/lib/api';
import { getImageAssetUrl, resolveAssetUrl } from '@/lib/assets';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  FileText,
  Lightbulb,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  MessageCircleQuestion,
  MessagesSquare,
  Shield,
  ShieldCheck,
  Star,
  ThumbsUp,
  Users,
  Workflow,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

type FloatName = 'float1' | 'float2' | 'float3';

/** Where each floating tile sits around the store logo (percent of the stage), and how it moves. Kept clear of the feature cards. */
const SLOTS: { x: number; y: number; size: 'sm' | 'md' | 'lg'; float: FloatName; duration: number; delay: number }[] = [
  { x: 12, y: 18, size: 'lg', float: 'float1', duration: 7.5, delay: 0 },
  { x: 40, y: 6, size: 'sm', float: 'float2', duration: 6.5, delay: -2 },
  { x: 60, y: 30, size: 'md', float: 'float3', duration: 8, delay: -4 },
  { x: 6, y: 50, size: 'md', float: 'float2', duration: 7.8, delay: -2.5 },
  { x: 28, y: 36, size: 'sm', float: 'float1', duration: 6.8, delay: -3.5 },
  { x: 76, y: 52, size: 'lg', float: 'float1', duration: 9, delay: -1 },
  { x: 96, y: 40, size: 'sm', float: 'float3', duration: 7.2, delay: -4.5 },
  { x: 30, y: 64, size: 'md', float: 'float3', duration: 8.5, delay: -5 },
  { x: 56, y: 76, size: 'sm', float: 'float2', duration: 7, delay: -3 },
  { x: 48, y: 96, size: 'md', float: 'float1', duration: 8.2, delay: -1.5 },
];

const SIZE_CLASSES = {
  sm: 'size-14 rounded-2xl text-2xl',
  md: 'size-[4.5rem] rounded-[1.35rem] text-3xl',
  lg: 'size-[5.5rem] rounded-[1.6rem] text-4xl',
} as const;

const SURFACE = 'border border-foreground/[0.08] bg-card shadow-[0_16px_40px_-16px_rgb(0_0_0/0.3)] dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.8)]';

/** Shown in the free slots when the catalog is private or has fewer apps than slots. */
const FALLBACK_ICONS: LucideIcon[] = [Workflow, Database, ShieldCheck, MessagesSquare, CalendarDays, BarChart3, FileText, Users, Mail, MapIcon];

const FAQ_EXAMPLES = [
  { question: 'Wie binde ich die App an unseren Keycloak an?', answers: 3 },
  { question: 'Gibt es ein Helm-Chart für OpenShift?', answers: 4 },
  { question: 'Welche Ressourcen braucht die App im Cluster?', answers: 2 },
  { question: 'Wie aktualisiere ich ohne Ausfallzeit auf die neue Version?', answers: 5 },
];

const DEMAND_STATUS = {
  open: { label: 'Offen', className: 'bg-muted text-muted-foreground' },
  planned: { label: 'Geplant', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  fulfilled: { label: 'Erfüllt', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
} as const;

const DEMAND_EXAMPLES: { title: string; status: keyof typeof DEMAND_STATUS; votes: number }[] = [
  { title: 'Gesucht: Self-hosted Whiteboard für Workshops', status: 'planned', votes: 12 },
  { title: 'Gesucht: Open-Source-Tool für Umfragen', status: 'open', votes: 8 },
  { title: 'Gesucht: Passwortmanager für Teams', status: 'planned', votes: 15 },
  { title: 'Gesucht: Ticketsystem für den IT-Support', status: 'fulfilled', votes: 21 },
];

const RATING_EXAMPLES = ['Erfahrungen anderer Behörden', 'Bewertungen aus der Praxis', 'Erfahrungsberichte aus dem Betrieb'];

/** What the stage shows on this visit; drawn once per page load so every refresh looks a little different. */
interface Stage {
  /** The app (or nothing) shown in each slot, indexed like SLOTS. */
  slotApps: (AppConfig | undefined)[];
  fallbacks: LucideIcon[];
  faq: (typeof FAQ_EXAMPLES)[number];
  demand: (typeof DEMAND_EXAMPLES)[number];
  rating: string;
  appCount: number | null;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const pickOne = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** A random selection of apps with a real logo first (so the stage shows recognisable icons rather than letters), scattered over random slots. */
function buildStage(apps: AppConfig[] | null): Stage {
  const list = apps ?? [];
  const withImage = shuffle(list.filter((app) => getImageAssetUrl(app.icon)));
  const withEmoji = shuffle(list.filter((app) => !getImageAssetUrl(app.icon) && app.icon));
  const chosen = [...withImage, ...withEmoji].slice(0, SLOTS.length);
  const slotApps: (AppConfig | undefined)[] = Array(SLOTS.length).fill(undefined);
  shuffle(SLOTS.map((_, index) => index)).forEach((slot, k) => { slotApps[slot] = chosen[k]; });
  return {
    slotApps,
    fallbacks: shuffle(FALLBACK_ICONS),
    faq: pickOne(FAQ_EXAMPLES),
    demand: pickOne(DEMAND_EXAMPLES),
    rating: pickOne(RATING_EXAMPLES),
    appCount: apps ? apps.length : null,
  };
}

/** Positions an element on the stage, fades it in, then lets it bob. */
function Floating({ x, y, float, duration, delay, enterDelay, children }: {
  x: number; y: number; float: FloatName; duration: number; delay: number; enterDelay: number; children: React.ReactNode;
}) {
  return (
    <div
      className="auth-tile-enter absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${enterDelay}ms` }}
    >
      <div className="auth-float" style={{ animation: `${float} ${duration}s ease-in-out ${delay}s infinite` }}>
        {children}
      </div>
    </div>
  );
}

/**
 * An app's logo in a stage tile. The frame shows straight away and the logo fades in once loaded,
 * so tiles never wait on slow images; a logo that fails to load becomes the slot's line icon instead of a broken image.
 */
function AppTile({ app, tile, fallback }: { app: AppConfig; tile: string; fallback: React.ReactNode }) {
  const src = getImageAssetUrl(app.icon);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  if (!src) {
    return <span className={`inline-flex items-center justify-center ${tile}`}>{app.icon}</span>;
  }
  if (status === 'failed') {
    return <span className={`inline-flex items-center justify-center text-muted-foreground ${tile}`}>{fallback}</span>;
  }
  return (
    <span className={`relative inline-flex overflow-hidden ${tile}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
        className={`size-full object-contain p-3 transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  );
}

function FloatingTiles({ stage }: { stage: Stage }) {
  return (
    <>
      {SLOTS.map((slot, index) => {
        const app = stage.slotApps[index];
        const Fallback = stage.fallbacks[index % stage.fallbacks.length];
        const tile = `${SIZE_CLASSES[slot.size]} ${SURFACE} text-foreground`;
        const fallbackIcon = <Fallback className={slot.size === 'sm' ? 'size-6' : 'size-7'} strokeWidth={1.75} />;
        return (
          <Floating key={index} {...slot} enterDelay={120 + index * 50}>
            {app ? (
              <AppTile app={app} tile={tile} fallback={fallbackIcon} />
            ) : (
              <span className={`inline-flex items-center justify-center text-muted-foreground ${tile}`}>{fallbackIcon}</span>
            )}
          </Floating>
        );
      })}
    </>
  );
}

/** A small mock of one of the store's features, floating among the apps. */
function FeatureCard({ icon: Icon, kicker, title, children }: { icon: LucideIcon; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className={`flex w-64 flex-col gap-2.5 rounded-2xl p-4 text-left ${SURFACE}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="inline-flex size-6 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-3.5" />
        </span>
        {kicker}
      </div>
      <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

function FeatureCards({ stage, faqEnabled }: { stage: Stage; faqEnabled: boolean }) {
  const status = DEMAND_STATUS[stage.demand.status];
  return (
    <>
      {faqEnabled && (
        <Floating x={84} y={12} float="float2" duration={10} delay={-3} enterDelay={420}>
          <FeatureCard icon={MessageCircleQuestion} kicker="FAQ" title={stage.faq.question}>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Beantwortet
            </span>
            <span>{stage.faq.answers} Antworten</span>
          </FeatureCard>
        </Floating>
      )}
      <Floating x={14} y={86} float="float3" duration={11} delay={-6} enterDelay={500}>
        <FeatureCard icon={Lightbulb} kicker="Bedarfsmeldung" title={stage.demand.title}>
          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${status.className}`}>{status.label}</span>
          <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3.5" /> {stage.demand.votes} Stimmen</span>
        </FeatureCard>
      </Floating>
      <Floating x={86} y={82} float="float1" duration={9.5} delay={-2} enterDelay={580}>
        <div className={`flex flex-col gap-1.5 rounded-2xl px-4 py-3 ${SURFACE}`}>
          <span className="flex gap-0.5 text-amber-500">
            {Array.from({ length: 5 }, (_, i) => <Star key={i} className="size-3.5 fill-current" />)}
          </span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">{stage.rating}</span>
        </div>
      </Floating>
    </>
  );
}

/** The full-screen split for sign-in and registration: the catalog's apps orbiting the store's logo, beside the form. */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const storeName = settings.storeName || 'JustApps';
  const storeDescription = settings.storeDescription || 'Zentraler App Store für Softwarelösungen der öffentlichen Verwaltung.';
  const logoSrc = isDark ? (settings.logoDarkUrl || settings.logoUrl || null) : (settings.logoUrl || null);
  const resolvedLogoSrc = resolveAssetUrl(logoSrc);

  // Drawn on the client only (no hydration mismatch) and only once the apps are known, so tiles never swap icons after appearing.
  const [stage, setStage] = useState<Stage | null>(null);
  useEffect(() => {
    if (!settingsLoaded) return;
    let active = true;
    const load: Promise<AppConfig[] | null> = settings.requireAuthForAppStore
      ? Promise.resolve(null)
      : fetchApi('/apps')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => (Array.isArray(data) ? data as AppConfig[] : null))
        .catch(() => null);
    void load.then((apps) => { if (active) setStage(buildStage(apps)); });
    return () => { active = false; };
  }, [settings.requireAuthForAppStore, settingsLoaded]);

  const logo = (className: string) => resolvedLogoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolvedLogoSrc} alt={storeName} className={`w-auto object-contain ${className}`} />
  ) : (
    <JustAppsLogo className={className} />
  );

  return (
    <div className="grid min-h-[calc(100dvh-0.25rem)] w-full lg:grid-cols-[minmax(0,1fr)_minmax(30rem,40%)]">
      <aside className="relative hidden flex-col overflow-hidden border-e border-foreground/[0.06] bg-muted/40 lg:flex">
        {/* Dot grid, faded towards the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-foreground/[0.09] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <header className="relative z-10 flex flex-col gap-2 p-12 pb-0">
          <h2 className="text-3xl font-semibold tracking-tight">{storeName}</h2>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">{storeDescription}</p>
        </header>

        <div aria-hidden className="relative mx-auto my-10 w-full max-w-4xl min-h-[28rem] flex-1 px-24">
          <div className="relative size-full">
            {/* Orbits */}
            <svg className="absolute inset-0 size-full text-foreground/[0.08]" preserveAspectRatio="none" viewBox="0 0 100 100">
              <ellipse cx="50" cy="50" rx="26" ry="24" fill="none" stroke="currentColor" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
              <ellipse cx="50" cy="50" rx="44" ry="42" fill="none" stroke="currentColor" strokeWidth="0.25" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            </svg>

            {/* Glow and the store's logo at the centre */}
            <div className="auth-glow absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.22),transparent_65%)] blur-2xl" />
            <div className="auth-tile-enter absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex size-32 items-center justify-center rounded-[2.25rem] border border-foreground/[0.08] bg-card p-6 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]">
                {logo('max-h-20 max-w-24 size-20')}
              </div>
            </div>

            {stage && (
              <>
                <FloatingTiles stage={stage} />
                <FeatureCards stage={stage} faqEnabled={settings.faqEnabled} />
              </>
            )}
          </div>
        </div>

        <footer className="relative z-10 flex items-end justify-between gap-6 p-12 pt-0">
          <dl className="flex gap-10">
            <div className="flex flex-col-reverse">
              <dt className="text-xs text-muted-foreground">Apps im Katalog</dt>
              <dd className="text-xl font-semibold tabular-nums">{stage?.appCount ?? '–'}</dd>
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-xs text-muted-foreground">Open Source</dt>
              <dd className="text-xl font-semibold">Offen</dd>
            </div>
          </dl>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="size-3.5" />
            Sicher. Transparent. Nachnutzbar.
          </p>
        </footer>
      </aside>

      <div className="flex flex-col bg-background px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <NextLink href="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" />
            Zum Katalog
          </NextLink>
          <ThemeSwitcher />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="mb-8 lg:hidden">{logo('h-12 max-w-40')}</div>
          <header className="mb-8 flex flex-col gap-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </header>
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </div>
  );
}
