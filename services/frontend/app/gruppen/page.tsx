import { GroupIcon } from '@/components/GroupIcon';
import { fetchApi } from '@/lib/api';
import { Layers2 } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'App-Gruppen' };
export const dynamic = 'force-dynamic';

interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  appCount?: number;
}

async function loadGroups(): Promise<AppGroup[]> {
  try {
    const res = await fetchApi('/app-groups', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function GruppenPage() {
  const groups = await loadGroups();

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Layers2 className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">App-Gruppen</h1>
          <p className="text-sm text-muted mt-0.5">Thematisch gebündelte Sammlungen von Apps</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Layers2 className="w-10 h-10 text-muted/40" />
          <p className="text-lg font-semibold text-foreground">Noch keine Gruppen vorhanden</p>
          <p className="text-sm text-muted">Administratoren können Gruppen unter Verwaltung anlegen.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/gruppen/${group.id}`}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md hover:bg-surface-secondary/60"
            >
              <div className="flex items-start justify-between gap-2">
                <GroupIcon icon={group.icon} name={group.name} className="h-9 w-9 rounded-xl bg-accent/10 text-accent shrink-0" />
                {group.appCount !== undefined && (
                  <span className="rounded-full border border-border bg-surface-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                    {group.appCount} {group.appCount === 1 ? 'App' : 'Apps'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground group-hover:text-accent transition-colors">{group.name}</p>
                {group.description && (
                  <p className="mt-1 text-sm text-muted line-clamp-2">{group.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
