'use client';

import { FAQSection } from '@/components/FAQSection';
import { useAuth } from '@/context/AuthContext';
import { useSettings, useStoreName } from '@/context/SettingsContext';
import { Card } from '@heroui/react';

export default function GlobalFAQPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const storeName = useStoreName();

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
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-10">
      <header className="max-w-2xl space-y-3">
        <p className="text-sm font-medium text-accent">Wissen aus der Community</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Ihre Fragen. Unsere Antworten.</h1>
        <p className="text-base leading-relaxed text-muted">
          Das globale FAQ für alles rund um {storeName}. Finden Sie hilfreiche Antworten oder stellen Sie Ihre eigene Frage.
        </p>
      </header>

      <FAQSection global canManageHighlights={user?.role === 'admin'} />
    </div>
  );
}
