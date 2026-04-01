'use client';

import { fetchApi } from '@/lib/api';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, FileEdit, Package, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
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

const OPERATION_LABELS: Record<string, string> = {
  'app.create': 'App erstellt',
  'app.update': 'App aktualisiert',
  'app.delete': 'App gelöscht',
  'user.create': 'Benutzer erstellt',
  'user.update': 'Benutzer aktualisiert',
  'user.delete': 'Benutzer gelöscht',
  'user.enable': 'Benutzer aktiviert',
  'user.disable': 'Benutzer deaktiviert',
  'settings.update': 'Einstellungen geändert',
};

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

export default function VerwaltungPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/admin/stats')
      .then((res) => (res.ok ? res.json() : Promise.reject('Fehler beim Laden')))
      .then((data: RawStatsResponse) => setStats(normalizeStatsResponse(data)))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-surface-secondary rounded" />
                <div className="w-8 h-8 rounded-xl bg-surface-secondary" />
              </div>
              <div className="h-8 w-14 bg-surface-secondary rounded" />
              <div className="h-3 w-28 bg-surface-secondary rounded" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="h-4 w-36 bg-surface-secondary rounded mb-6" />
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-surface-secondary mt-1.5 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-surface-secondary rounded w-1/3" />
                  <div className="h-3 bg-surface-secondary rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return <p className="text-sm text-danger">{error || 'Statistiken konnten nicht geladen werden.'}</p>;
  }

  const statCards = [
    { label: 'Apps gesamt', value: stats.totalApps, icon: Package, sub: `${stats.newAppsThisWeek} diese Woche` },
    { label: 'Benutzer', value: stats.totalUsers, icon: Users, sub: `${stats.newUsersThisWeek} diese Woche` },
    { label: 'Entwürfe', value: stats.draftApps, icon: FileEdit, sub: 'Unveröffentlichte Apps' },
    { label: 'Neue Apps', value: stats.newAppsThisWeek, icon: TrendingUp, sub: 'Diese Woche erstellt' },
    { label: 'Probe-Probleme', value: stats.appsWithProbeIssues, icon: AlertTriangle, sub: stats.linkProbingEnabled ? 'Apps mit Fehlern' : 'Link-Prüfung deaktiviert' },
    { label: 'Komplett down', value: stats.downApps, icon: Activity, sub: `${stats.partialApps} teilweise betroffen` },
  ];
  const shownIssueCount = stats.linkProbeIssues.length;
  const hasMoreIssues = stats.appsWithProbeIssues > shownIssueCount;

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, sub }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-accent" />
              </div>
            </div>
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <span className="text-xs text-muted">{sub}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Erreichbarkeit</h2>
            <p className="mt-1 text-sm text-muted">
              {stats.linkProbingEnabled
                ? 'Backend-prüfte Live-Endpunkte mit den zuletzt festgestellten Problemen.'
                : 'Die Backend-Link-Prüfung ist aktuell deaktiviert.'}
            </p>
          </div>
        </div>

        {!stats.linkProbingEnabled ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface-secondary/40 px-4 py-6 text-sm text-muted">
            Aktiviere die Link-Prüfung in den Einstellungen, damit Ausfälle hier gesammelt angezeigt werden.
          </p>
        ) : stats.linkProbeIssues.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface-secondary/40 px-4 py-6 text-sm text-muted">
            Aktuell sind keine fehlerhaften Live-Endpunkte bekannt.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Betroffene Apps</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{stats.appsWithProbeIssues}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Komplett down</p>
                <p className="mt-1 text-2xl font-bold text-danger">{stats.downApps}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Teilweise down</p>
                <p className="mt-1 text-2xl font-bold text-warning">{stats.partialApps}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-secondary/20 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Auffällige Apps</p>
                  <p className="text-xs text-muted">
                    {hasMoreIssues
                      ? `Zeigt ${shownIssueCount} von ${stats.appsWithProbeIssues} Apps mit Problemen.`
                      : 'Kompakte Übersicht mit aufklappbaren Details pro App.'}
                  </p>
                </div>
              </div>

              <div className="max-h-[26rem] overflow-y-auto">
                {stats.linkProbeIssues.map((issue) => {
                  const isExpanded = expandedIssueId === issue.appId;
                  const reachableCount = issue.endpoints.filter((endpoint) => endpoint.reachable).length;
                  const failingCount = issue.endpoints.length - reachableCount;

                  return (
                    <div key={issue.appId} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-secondary/40"
                        onClick={() => setExpandedIssueId(isExpanded ? null : issue.appId)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/apps/${issue.appId}`}
                              className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {issue.appName}
                            </Link>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${issue.status === 'down' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                              {issue.status === 'down' ? 'Down' : 'Teilweise down'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {reachableCount > 0
                              ? `${reachableCount} von ${issue.endpoints.length} Endpunkten erreichbar`
                              : `${failingCount} problematische${failingCount === 1 ? 'r Endpunkt' : ' Endpunkte'}`}
                          </p>
                        </div>

                        <div className="hidden min-w-0 flex-1 text-xs text-muted md:block">
                          {issue.endpoints[0]?.label || 'Keine Detaildaten'}
                        </div>

                        <div className="shrink-0 text-muted">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="space-y-3 border-t border-border bg-surface px-4 py-4">
                          {issue.endpoints.map((endpoint) => (
                            <div key={`${issue.appId}-${endpoint.url}-${endpoint.label}`} className="rounded-xl border border-border bg-surface-secondary/20 px-3 py-3">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${endpoint.reachable ? 'bg-success' : 'bg-danger'}`} />
                                    <p className="text-sm font-medium text-foreground">{endpoint.label}</p>
                                  </div>
                                  <a href={endpoint.url} target="_blank" rel="noreferrer" className="text-xs text-muted break-all hover:text-accent transition-colors">
                                    {endpoint.url}
                                  </a>
                                </div>
                                <span className={`text-xs font-medium ${endpoint.reachable ? 'text-success' : 'text-danger'}`}>
                                  {endpoint.httpStatus ? `HTTP ${endpoint.httpStatus}` : endpoint.status}
                                </span>
                              </div>
                              {endpoint.lastCheckedAt && (
                                <p className="mt-2 text-[11px] text-muted/70">
                                  Zuletzt geprüft {relativeTime(endpoint.lastCheckedAt)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-5">Letzte Aktivitäten</h2>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">Noch keine Aktivitäten vorhanden.</p>
        ) : (
          <ol className="space-y-4">
            {stats.recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent/60 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {OPERATION_LABELS[entry.operation] ?? entry.operation}
                  </p>
                  {entry.details && (
                    <p className="text-xs text-muted truncate">{entry.details}</p>
                  )}
                  <p className="text-xs text-muted/60 mt-0.5">
                    {entry.username || entry.email || entry.user_id} · {relativeTime(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
