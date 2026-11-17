import { Card } from '@/components/panelui/card';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import NextLink from 'next/link';

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

/** A group's landing page: what is in it, one row per page. */
export function AdminOverviewPage({ title, description, cards, children }: AdminOverviewPageProps) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="max-w-3xl text-pretty text-muted-foreground">{description}</p>
      </header>

      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {cards.map(({ href, title: cardTitle, description: cardDescription, icon: Icon, note }) => (
            <li key={href}>
              <NextLink
                href={href}
                className="group flex items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{cardTitle}</span>
                  <span className="text-sm text-muted-foreground">{cardDescription}</span>
                  {note && <span className="text-xs text-muted-foreground">{note}</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </NextLink>
            </li>
          ))}
        </ul>
      </Card>

      {children}
    </div>
  );
}
