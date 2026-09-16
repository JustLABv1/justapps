'use client';

import { FAQSection } from '@/components/FAQSection';
import { FAQInsights } from '@/components/FAQInsights';
import { PageContainer, PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useSettings, useStoreName } from '@/context/SettingsContext';
import { hasPermission, Permission } from '@/lib/permissions';
import { Card } from '@heroui/react';

export default function GlobalFAQPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const storeName = useStoreName();
  const canViewInsights = hasPermission(user?.role, Permission.ViewFAQInsights, user?.permissions);

  if (!settings.faqEnabled) {
    return (
      <PageContainer>
        <Card variant="secondary">
          <Card.Content className="p-8 text-center text-muted">Das FAQ ist derzeit deaktiviert.</Card.Content>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Wissen aus der Community"
        title="Ihre Fragen. Unsere Antworten."
        description={`Das globale FAQ für alles rund um ${storeName}. Finden Sie hilfreiche Antworten oder stellen Sie Ihre eigene Frage.`}
      />

      {canViewInsights && <FAQInsights />}

      <FAQSection
        global
        canDeleteQuestions={hasPermission(user?.role, Permission.DeleteFAQQuestions, user?.permissions)}
        canDeleteAnswers={hasPermission(user?.role, Permission.DeleteFAQAnswers, user?.permissions)}
        canPinAnswers={hasPermission(user?.role, Permission.PinFAQAnswers, user?.permissions)}
        canRecommendAnswers={hasPermission(user?.role, Permission.RecommendFAQAnswers, user?.permissions)}
      />
    </PageContainer>
  );
}
