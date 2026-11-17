'use client';

import { Alert } from '@/components/panelui/alert';
import { Badge } from '@/components/panelui/badge';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Stat } from '@/components/panelui/stat';
import { fetchApi } from '@/lib/api';
import { adminNavGroups } from '@/lib/admin-navigation';
import { auditOperationLabel } from '@/lib/auditOperations';
import { ArrowRight, ChevronDown, ExternalLink, FileText } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

interface AuditEntry {
  id: string;
  user_id: string;
  operation: string;
  details: string;
  created_at: string;
  username?: string;
  email?: string;
}

interface ProbeEndpoint {
  label: string;
  url: string;
  status: string;
  reachable: boolean;
  httpStatus?: number;
  lastCheckedAt?: string;
}

interface ProbeIssue {
  appId: string;
  appName: string;
  status: 'partial' | 'down';
  endpoints: ProbeEndpoint[];
}

interface RawStatsResponse {
  totalApps: number;
  draftApps: number;
  totalUsers: number;
  newUsersThisWeek: number;
  newAppsThisWeek: number;
  linkProbingEnabled: boolean;
  appsWithProbeIssues: number;
  downApps: number;
  partialApps: number;
  linkProbeIssues?: Array<{
    appId?: string;
    appName?: string;
    name?: string;
    status?: 'partial' | 'down';
    linkProbeStatus?: 'partial' | 'down';
    endpoints?: Array<{
      label?: string;
      url?: string;
      status?: string;
      reachable?: boolean;
      statusCode?: number;
      httpStatus?: number;
      probedAt?: string;
      lastCheckedAt?: string;
    }>;
    failedEndpoints?: Array<{
      url?: string;
      statusCode?: number;
      probedAt?: string;
    }>;
  }>;
  recentActivity: AuditEntry[];
}

interface StatsResponse extends Omit<RawStatsResponse, 'linkProbeIssues'> {
  linkProbeIssues: ProbeIssue[];
}


function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
}

function getEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`;
  } catch {
    return 'Endpunkt';
  }
}

function normalizeStatsResponse(data: RawStatsResponse): StatsResponse {
  const linkProbeIssues = Array.isArray(data.linkProbeIssues) ? data.linkProbeIssues : [];

  return {
    ...data,
    linkProbeIssues: linkProbeIssues.map((issue) => {
      const endpoints = Array.isArray(issue.endpoints)
        ? issue.endpoints
            .filter((endpoint): endpoint is NonNullable<typeof endpoint> => Boolean(endpoint?.url))
            .map((endpoint) => {
              const httpStatus = endpoint.httpStatus ?? endpoint.statusCode;
              const reachable = endpoint.reachable ?? true;

              return {
                label: endpoint.label || getEndpointLabel(endpoint.url || ''),
                url: endpoint.url || '',
                status: endpoint.status || (httpStatus ? `HTTP ${httpStatus}` : (reachable ? 'Erreichbar' : 'Nicht erreichbar')),
                reachable,
                httpStatus,
                lastCheckedAt: endpoint.lastCheckedAt || endpoint.probedAt,
              };
            })
        : Array.isArray(issue.failedEndpoints)
          ? issue.failedEndpoints
              .filter((endpoint): endpoint is NonNullable<typeof endpoint> => Boolean(endpoint?.url))
              .map((endpoint) => ({
                label: getEndpointLabel(endpoint.url || ''),
                url: endpoint.url || '',
                status: endpoint.statusCode ? `HTTP ${endpoint.statusCode}` : 'Nicht erreichbar',
                reachable: false,
                httpStatus: endpoint.statusCode,
                lastCheckedAt: endpoint.probedAt,
              }))
          : [];

      return {
        appId: issue.appId || '',
        appName: issue.appName || issue.name || 'Unbekannte App',
        status: issue.status || issue.linkProbeStatus || 'partial',
        endpoints,
      };
    }),
  };
}

const SHORTCUTS = [
  '/verwaltung/katalog/apps',
  '/verwaltung/sicherheit/benutzer',
  '/verwaltung/sicherheit/zugriff',
  '/verwaltung/plattform/gestaltung',
];

export default function VerwaltungPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Übersicht</h1>
        <p className="text-muted-foreground">Wie es der Plattform gerade geht und was Aufmerksamkeit braucht.</p>
      </header>
      <AdminDashboard />
    </div>
  );
}

function IssueRow({ issue }: { issue: ProbeIssue }) {
  const [open, setOpen] = useState(false);
  const reachable = issue.endpoints.filter((endpoint) => endpoint.reachable).length;
  const down = issue.status === 'down';

  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${down ? 'bg-destructive' : 'bg-warning'}`} />
        <div className="flex min-w-0 flex-1 flex-col">
          <NextLink href={`/apps/${issue.appId}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">
            {issue.appName}
          </NextLink>
          <span className="text-xs text-muted-foreground">
            {issue.endpoints.length > 0
              ? `${reachable} von ${issue.endpoints.length} Endpunkten erreichbar`
              : 'Keine Detaildaten'}
          </span>
        </div>
        <Badge variant={down ? 'destructive' : 'warning'} size="sm">{down ? 'Nicht erreichbar' : 'Teilweise'}</Badge>
        {issue.endpoints.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-label={open ? `Endpunkte von ${issue.appName} ausblenden` : `Endpunkte von ${issue.appName} zeigen`}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-2 px-5 pb-4 ps-10">
          {issue.endpoints.map((endpoint) => (
            <li key={`${endpoint.url}-${endpoint.label}`} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2">
              <span aria-hidden="true" className={`mt-1.5 size-1.5 shrink-0 rounded-full ${endpoint.reachable ? 'bg-success' : 'bg-destructive'}`} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">{endpoint.label}</span>
                <a href={endpoint.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground">
                  <span className="truncate">{endpoint.url}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
              <span className="flex shrink-0 flex-col items-end text-xs">
                <span className={endpoint.reachable ? 'text-success' : 'text-destructive'}>
                  {endpoint.httpStatus ? `HTTP ${endpoint.httpStatus}` : endpoint.status}
                </span>
                {endpoint.lastCheckedAt && <span className="text-muted-foreground">{relativeTime(endpoint.lastCheckedAt)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Card className="grid grid-cols-2 gap-0 divide-x py-0 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex flex-col gap-3 p-5">
            <span className="h-3 w-20 animate-pulse rounded bg-muted" />
            <span className="h-8 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <span className="h-64 animate-pulse rounded-2xl bg-muted" />
        <span className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/admin/stats')
      .then((res) => (res.ok ? res.json() : Promise.reject('Statistiken konnten nicht geladen werden.')))
      .then((data: RawStatsResponse) => setStats(normalizeStatsResponse(data)))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !stats) {
    return (
      <Alert variant="plain" tone="destructive">
        <Alert.Icon />
        <Alert.Title>{error || 'Statistiken konnten nicht geladen werden.'}</Alert.Title>
      </Alert>
    );
  }

  const shortcuts = adminNavGroups.flatMap((group) => group.items).filter((item) => SHORTCUTS.includes(item.href));
  const attention = [
    stats.downApps > 0 && { tone: 'destructive' as const, text: `${stats.downApps} ${stats.downApps === 1 ? 'App ist' : 'Apps sind'} nicht erreichbar`, href: '/verwaltung/katalog/gesundheit', action: 'Prüfen' },
    stats.partialApps > 0 && { tone: 'warning' as const, text: `${stats.partialApps} ${stats.partialApps === 1 ? 'App ist' : 'Apps sind'} nur teilweise erreichbar`, href: '/verwaltung/katalog/gesundheit', action: 'Prüfen' },
    stats.draftApps > 0 && { tone: 'info' as const, text: `${stats.draftApps} ${stats.draftApps === 1 ? 'Entwurf wartet' : 'Entwürfe warten'} auf Veröffentlichung`, href: '/verwaltung/katalog/apps', action: 'Ansehen' },
  ].filter(Boolean) as { tone: 'destructive' | 'warning' | 'info'; text: string; href: string; action: string }[];

  const figures = [
    { label: 'Apps', value: stats.totalApps, badge: stats.newAppsThisWeek > 0 ? `+${stats.newAppsThisWeek} diese Woche` : null, href: '/verwaltung/katalog/apps' },
    { label: 'Benutzer', value: stats.totalUsers, badge: stats.newUsersThisWeek > 0 ? `+${stats.newUsersThisWeek} diese Woche` : null, href: '/verwaltung/sicherheit/benutzer' },
    { label: 'Entwürfe', value: stats.draftApps, badge: null, href: '/verwaltung/katalog/apps' },
    {
      label: 'Erreichbarkeit',
      value: stats.linkProbingEnabled ? stats.appsWithProbeIssues : '–',
      badge: !stats.linkProbingEnabled ? 'Prüfung aus' : stats.appsWithProbeIssues === 0 ? 'Alles erreichbar' : 'mit Problemen',
      href: '/verwaltung/katalog/gesundheit',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {attention.length > 0 && (
        <Card className="gap-0 py-0" aria-label="Braucht Aufmerksamkeit" render={<section />}>
          <ul className="divide-y">
            {attention.map((item) => (
              <li key={item.text} className="flex items-center gap-3 px-5 py-3">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${item.tone === 'destructive' ? 'bg-destructive' : item.tone === 'warning' ? 'bg-warning' : 'bg-info'}`} />
                <span className="flex-1 text-sm">{item.text}</span>
                <Button size="sm" variant="ghost" render={<NextLink href={item.href} />}>
                  {item.action}
                  <ArrowRight />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="grid grid-cols-2 gap-0 divide-y py-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {figures.map((figure) => (
          <NextLink
            key={figure.label}
            href={figure.href}
            className="p-5 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Stat className="flex-col items-start gap-2">
              <Stat.Content>
                <Stat.Label>{figure.label}</Stat.Label>
                <Stat.Value size="md">{figure.value}</Stat.Value>
              </Stat.Content>
              {figure.badge && <Stat.Badge>{figure.badge}</Stat.Badge>}
            </Stat>
          </NextLink>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Card className="gap-0 py-0">
          <Card.Header className="border-b py-4">
            <Card.Title>Erreichbarkeit</Card.Title>
            <Card.Description>
              {stats.linkProbingEnabled
                ? 'Live-Endpunkte, die bei der letzten Prüfung nicht wie erwartet geantwortet haben.'
                : 'Die Link-Prüfung ist ausgeschaltet.'}
            </Card.Description>
          </Card.Header>
          {!stats.linkProbingEnabled ? (
            <div className="flex flex-col items-start gap-3 px-5 py-6 text-sm text-muted-foreground">
              Schalten Sie die Link-Prüfung ein, damit Ausfälle hier gesammelt erscheinen.
              <Button size="sm" variant="secondary" render={<NextLink href="/verwaltung/katalog/einstellungen" />}>Link-Prüfung einrichten</Button>
            </div>
          ) : stats.linkProbeIssues.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Alle geprüften Endpunkte sind erreichbar.</p>
          ) : (
            <>
              <ul className="max-h-[28rem] divide-y overflow-y-auto">
                {stats.linkProbeIssues.map((issue) => <IssueRow key={issue.appId} issue={issue} />)}
              </ul>
              {stats.appsWithProbeIssues > stats.linkProbeIssues.length && (
                <div className="border-t px-5 py-3">
                  <Button variant="ghost" size="sm" render={<NextLink href="/verwaltung/katalog/gesundheit" />}>
                    Alle {stats.appsWithProbeIssues} betroffenen Apps
                    <ArrowRight />
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-0 py-0">
            <Card.Header className="border-b py-4">
              <Card.Title>Letzte Aktivitäten</Card.Title>
            </Card.Header>
            {stats.recentActivity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
            ) : (
              <ol className="flex flex-col gap-4 px-5 py-4">
                {stats.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{auditOperationLabel(entry.operation)}</span>
                      {entry.details && <span className="truncate text-xs text-muted-foreground">{entry.details}</span>}
                      <span className="text-xs text-muted-foreground">
                        {entry.username || entry.email || 'Unbekannt'} · {relativeTime(entry.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="border-t px-5 py-3">
              <Button variant="ghost" size="sm" render={<NextLink href="/verwaltung/sicherheit/audit" />}>
                <FileText />
                Aktivitätsprotokoll
              </Button>
            </div>
          </Card>

          <Card size="sm">
            <Card.Header>
              <Card.Title>Häufig gebraucht</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-1">
              {shortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <NextLink
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </NextLink>
                );
              })}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
