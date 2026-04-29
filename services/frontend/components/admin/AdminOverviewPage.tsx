import type { LucideIcon } from 'lucide-react';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

type AdminOverviewCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  note?: string;
};

type AdminOverviewPageProps = {
  title: string;
  description: string;
  cards: AdminOverviewCard[];
  children?: React.ReactNode;
};

export function AdminOverviewPage({ title, description, cards, children }: AdminOverviewPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-3xl text-sm text-muted">{description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, title: cardTitle, description: cardDescription, icon: Icon, note }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-[200px] flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>

            <div className="mt-8 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{cardTitle}</h2>
                <p className="mt-2 text-sm text-muted">{cardDescription}</p>
              </div>

              {note ? <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{note}</p> : null}
            </div>
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}