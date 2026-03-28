'use client';

import { fetchApi } from '@/lib/api';
import { FileEdit, Package, TrendingUp, Users } from 'lucide-react';
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

interface StatsResponse {
  totalApps: number;
  draftApps: number;
  totalUsers: number;
  newUsersThisWeek: number;
  newAppsThisWeek: number;
  recentActivity: AuditEntry[];
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

export default function VerwaltungPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi('/admin/stats')
      .then((res) => (res.ok ? res.json() : Promise.reject('Fehler beim Laden')))
      .then((data: StatsResponse) => setStats(data))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-secondary border border-border" />
        ))}
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
    { label: 'Neu diese Woche', value: stats.newAppsThisWeek, icon: TrendingUp, sub: 'Apps & Benutzer' },
  ];

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
