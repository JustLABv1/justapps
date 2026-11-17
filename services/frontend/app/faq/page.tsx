'use client';

import { FAQInsights } from '@/components/FAQInsights';
import { FAQSection, type FAQStatusFilter } from '@/components/FAQSection';
import { Button } from '@/components/panelui/button';
import { Card } from '@/components/panelui/card';
import { Input } from '@/components/panelui/input';
import { useAuth } from '@/context/AuthContext';
import { useSettings, useStoreName } from '@/context/SettingsContext';
import { fetchApi } from '@/lib/api';
import { hasPermission, Permission } from '@/lib/permissions';
import { HandHelping, MessageCircleQuestion, Plus, Search, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/** How many questions still wait for a first answer. */
function useOpenCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => fetchApi('/faq?status=open&page=1&pageSize=1', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { total?: number } | null) => { if (active && data) setCount(data.total ?? 0); })
      .catch(() => {});
    void load();
    window.addEventListener('faq:changed', load);
    return () => {
      active = false;
      window.removeEventListener('faq:changed', load);
    };
  }, []);
  return count;
}

function GlobalFAQContent() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const storeName = useStoreName();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<FAQStatusFilter>('all');
  const [askRequest, setAskRequest] = useState(0);
  const openCount = useOpenCount();
  const canViewInsights = hasPermission(user?.role, Permission.ViewFAQInsights, user?.permissions);

  if (!settings.faqEnabled) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <MessageCircleQuestion className="size-8 text-muted-foreground/50" />
        <p className="font-medium">Das FAQ ist derzeit deaktiviert.</p>
      </div>
    );
  }

  const showOpen = () => {
    setQuery('');
    setStatus('open');
    document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex w-full flex-col gap-10 pb-16">
      {/* ── Search first: most visitors come with a question ── */}
      <header className="flex flex-col items-center gap-4 rounded-3xl border bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--info)_14%,transparent),transparent_70%)] px-4 py-8 text-center sm:py-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Wie können wir helfen?</h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground text-pretty sm:text-base">
            Fragen und Antworten rund um {storeName} und seine Apps.
          </p>
        </div>
        <Input.Group className="w-full max-w-xl">
          <Input.Addon><Search /></Input.Addon>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Frage, Stichwort oder App suchen"
            aria-label="FAQ durchsuchen"
          />
          {query && (
            <Input.Addon align="end">
              <button type="button" aria-label="Suche löschen" onClick={() => setQuery('')} className="cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </Input.Addon>
          )}
        </Input.Group>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <FAQSection
          // A link to one question (?frage=…) starts the list over on it.
          key={searchParams.get('frage') ?? 'all'}
          global
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          askRequest={askRequest}
          canDeleteQuestions={hasPermission(user?.role, Permission.DeleteFAQQuestions, user?.permissions)}
          canDeleteAnswers={hasPermission(user?.role, Permission.DeleteFAQAnswers, user?.permissions)}
          canPinAnswers={hasPermission(user?.role, Permission.PinFAQAnswers, user?.permissions)}
          canRecommendAnswers={hasPermission(user?.role, Permission.RecommendFAQAnswers, user?.permissions)}
        />

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start" aria-label="Mitmachen">
          <Card>
            <Card.Header>
              <Card.Title as="h2" className="text-sm">Nichts Passendes gefunden?</Card.Title>
              <Card.Description>Stell deine Frage. Die Community und die Betreuer der Apps antworten hier.</Card.Description>
            </Card.Header>
            <Card.Footer variant="panel">
              {user ? (
                <Button className="w-full" onClick={() => setAskRequest((value) => value + 1)}>
                  <Plus />
                  Frage stellen
                </Button>
              ) : (
                <Button className="w-full" render={<a href="/login" />}>Anmelden, um zu fragen</Button>
              )}
            </Card.Footer>
          </Card>

          {openCount !== null && openCount > 0 && (
            <Card>
              <Card.Header>
                <Card.Title as="h2" className="flex items-center gap-2 text-sm">
                  <HandHelping className="size-4 text-muted-foreground" />
                  Hilf anderen
                </Card.Title>
                <Card.Description>
                  {openCount === 1 ? '1 Frage wartet' : `${openCount} Fragen warten`} noch auf eine erste Antwort.
                </Card.Description>
              </Card.Header>
              <Card.Footer variant="panel">
                <Button variant="outline" className="w-full" onClick={showOpen}>Offene Fragen zeigen</Button>
              </Card.Footer>
            </Card>
          )}

          {canViewInsights && <FAQInsights />}
        </aside>
      </div>
    </div>
  );
}

export default function GlobalFAQPage() {
  return (
    <Suspense>
      <GlobalFAQContent />
    </Suspense>
  );
}
