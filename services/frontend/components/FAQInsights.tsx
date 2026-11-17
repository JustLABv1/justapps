'use client';

import { Card } from '@/components/panelui/card';
import { Spinner } from '@/components/panelui/spinner';
import { fetchApi } from '@/lib/api';
import { BarChart3, CheckCircle2, ChevronRight } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

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

/** Platform-wide FAQ activity for moderators: a few figures and the questions waiting longest. */
export function FAQInsights() {
  const [data, setData] = useState<FAQInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchApi('/faq/insights', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() as Promise<FAQInsightsData> : null))
      .then((result) => { if (active) setData(result); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!loading && !data) return null;

  const stats = data ? [
    { label: 'Antwortquote', value: `${Math.round(data.answerRate)} %` },
    { label: 'Bis zur 1. Antwort', value: formatDuration(data.summary.medianFirstAnswerSeconds) },
    { label: 'Fragen · 7 Tage', value: data.summary.questionsLast7Days },
    { label: 'Antworten · 7 Tage', value: data.summary.answersLast7Days },
  ] : [];

  return (
    <Card>
      <Card.Header>
        <Card.Title as="h2" className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4 text-muted-foreground" />
          Insights
        </Card.Title>
        <Card.Description>Nur für Moderation sichtbar.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-5">
        {loading || !data ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {stats.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Am längsten offen</h3>
              {data.oldestOpen.length === 0 ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-success" />
                  Alle Fragen sind beantwortet.
                </p>
              ) : (
                <ul className="-mx-2 flex flex-col">
                  {data.oldestOpen.slice(0, 5).map((question) => (
                    <li key={question.id}>
                      <NextLink
                        href={question.scope === 'global' ? `/faq?frage=${question.id}` : `/apps/${question.appId}?frage=${question.id}#faq`}
                        className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">{question.question}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {question.scope === 'global' ? 'Allgemein' : question.appName} · {new Date(question.createdAt).toLocaleDateString('de-DE')}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </NextLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
