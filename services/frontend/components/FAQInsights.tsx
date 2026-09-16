'use client';

import { fetchApi } from '@/lib/api';
import { Button, Disclosure, Spinner } from '@heroui/react';
import { BarChart3, CheckCircle2, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FAQInsightsData {
  summary: {
    totalQuestions: number;
    openQuestions: number;
    answeredQuestions: number;
    questionsLast7Days: number;
    questionsLast30Days: number;
    answersLast7Days: number;
    answersLast30Days: number;
    medianFirstAnswerSeconds?: number | null;
  };
  answerRate: number;
  oldestOpen: Array<{
    id: string;
    scope: 'app' | 'global';
    appId?: string | null;
    appName?: string;
    question: string;
    username: string;
    createdAt: string;
  }>;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return '–';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} Min.`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} Std.`;
  return `${Math.round(seconds / 86400)} Tage`;
}

export function FAQInsights() {
  const router = useRouter();
  const [data, setData] = useState<FAQInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchApi('/faq/insights', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<FAQInsightsData> : null)
      .then((result) => { if (active) setData(result); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!loading && !data) return null;

  const stats = [
    { label: 'Offene Fragen', value: data?.summary.openQuestions ?? 0 },
    { label: 'Antwortquote', value: data ? `${Math.round(data.answerRate)} %` : '–' },
    { label: 'Median bis Antwort', value: formatDuration(data?.summary.medianFirstAnswerSeconds) },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <Disclosure isExpanded={expanded} onExpandedChange={setExpanded}>
        <Disclosure.Heading>
          <Button slot="trigger" variant="ghost" className="h-auto w-full justify-between rounded-none px-4 py-3.5 text-left sm:px-5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><BarChart3 className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">FAQ Insights</span>
                <span className="block truncate text-xs font-normal text-muted">Plattformweite Aktivität und offene Fragen</span>
              </span>
            </span>
            {loading ? <Spinner size="sm" /> : (
              <span className="ml-auto hidden items-center gap-7 lg:flex">
                {stats.map(({ label, value }) => <span key={label} className="min-w-20 text-right"><span className="block text-xs font-normal text-muted">{label}</span><span className="block font-semibold text-foreground">{value}</span></span>)}
              </span>
            )}
            <Disclosure.Indicator className="ml-2 shrink-0 text-muted" />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="border-t border-border px-4 py-4 sm:px-5">
            {data && (
              <div className="space-y-4">
                <section aria-labelledby="faq-activity-heading">
                  <h3 id="faq-activity-heading" className="mb-2.5 text-sm font-semibold text-foreground">Aktivität</h3>
                  <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
                    {[
                      ['Fragen · 7 Tage', data.summary.questionsLast7Days],
                      ['Antworten · 7 Tage', data.summary.answersLast7Days],
                      ['Fragen · 30 Tage', data.summary.questionsLast30Days],
                      ['Antworten · 30 Tage', data.summary.answersLast30Days],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-surface-secondary px-3.5 py-3">
                        <span className="block text-xs text-muted">{label}</span>
                        <strong className="mt-0.5 block text-lg text-foreground">{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section aria-labelledby="faq-oldest-heading">
                  <h3 id="faq-oldest-heading" className="mb-2.5 text-sm font-semibold text-foreground">Am längsten offen</h3>
                  {data.oldestOpen.length === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/5 px-3.5 py-3 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      <span>Alle Fragen sind beantwortet.</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {data.oldestOpen.map((question) => (
                        <div key={question.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{question.question}</p><p className="text-xs text-muted">{question.scope === 'global' ? 'Globales FAQ' : question.appName} · {new Date(question.createdAt).toLocaleDateString('de-DE')}</p></div>
                          <Button isIconOnly size="sm" variant="ghost" aria-label="Offene Frage anzeigen" onPress={() => router.push(question.scope === 'global' ? '/faq' : `/apps/${question.appId}#faq`)}><ExternalLink className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}
