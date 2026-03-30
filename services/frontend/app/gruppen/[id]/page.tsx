'use client';

import { AppCard } from '@/components/AppCard';
import { AppConfig } from '@/config/apps';
import { fetchApi } from '@/lib/api';
import { ChevronLeft, Layers2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AppGroup {
  id: string;
  name: string;
  description?: string;
}

export default function GruppenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<AppGroup | null>(null);
  const [members, setMembers] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchApi('/app-groups').then((r) => r.ok ? r.json() as Promise<AppGroup[]> : []),
      fetchApi(`/apps?group=${id}`).then((r) => r.ok ? r.json() as Promise<{ apps: AppConfig[] }> : { apps: [] }),
    ]).then(([groups, appsRes]) => {
      const found = groups.find((g) => g.id === id) ?? null;
      if (!found) { setNotFound(true); } else { setGroup(found); }
      setMembers(appsRes.apps ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4">
        <Link
          href="/gruppen"
          className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Alle Gruppen
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Gruppe nicht gefunden</p>
          <p className="text-sm text-muted">Diese Gruppe existiert nicht oder wurde gelöscht.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <Link
        href="/gruppen"
        className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Alle Gruppen
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Layers2 className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{group?.name}</h1>
          {group?.description && (
            <p className="text-sm text-muted mt-0.5">{group.description}</p>
          )}
        </div>
        <span className="ml-auto rounded-full border border-border bg-surface-secondary px-3 py-1 text-sm font-semibold text-muted">
          {members.length} {members.length === 1 ? 'App' : 'Apps'}
        </span>
      </div>

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Noch keine Apps in dieser Gruppe</p>
          <p className="text-sm text-muted">Administratoren können Apps über den App-Editor Gruppen zuweisen.</p>
        </div>
      ) : (
        <section className="columns-1 md:columns-2 lg:columns-3 gap-x-5" aria-label={group ? `Apps in ${group.name}` : 'Apps'}>
          {members.map((app) => (
            <div key={app.id} className="break-inside-avoid mb-5">
              <AppCard app={app} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
