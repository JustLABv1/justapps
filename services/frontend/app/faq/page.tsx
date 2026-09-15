'use client';

import { FAQSection } from '@/components/FAQSection';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Card } from '@heroui/react';
import { MessageCircleQuestion } from 'lucide-react';

export default function GlobalFAQPage() {
  const { user } = useAuth();
  const { settings } = useSettings();

  if (!settings.faqEnabled) {
    return (
      <div className="mx-auto w-full max-w-6xl pb-10">
        <Card variant="secondary">
          <Card.Content className="p-8 text-center text-muted">Das FAQ ist derzeit deaktiviert.</Card.Content>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-7 shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/8 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-accent/8 text-accent">
            <MessageCircleQuestion className="h-5 w-5" />
          </div>
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Globales FAQ</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Stellen Sie allgemeine Fragen zu JustApps und finden Sie Antworten aus der Community.
            </p>
          </div>
        </div>
      </header>

      <FAQSection global canManageHighlights={user?.role === 'admin'} />
    </div>
  );
}
