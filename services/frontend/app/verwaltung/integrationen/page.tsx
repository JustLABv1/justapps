import { AdminOverviewPage } from '@/components/admin/AdminOverviewPage';
import { Bot, GitBranch, Workflow } from 'lucide-react';

export default function VerwaltungIntegrationenPage() {
  return (
    <AdminOverviewPage
      title="Integrationen"
      description="Verwaltet externe Anbindungen, Synchronisationen und die technische Automatisierung der Plattform."
      cards={[
        {
          href: '/verwaltung/integrationen/repository-sync',
          title: 'Repository Sync',
          description: 'Überwachen Sie den Abgleich verknüpfter Apps und greifen Sie in offene Änderungen ein.',
          icon: Workflow,
          note: 'Sync und Status',
        },
        {
          href: '/verwaltung/integrationen/repository-providers',
          title: 'Repository-Provider',
          description: 'Pflegen Sie GitLab- und GitHub-Provider, Tokens und Standardpfade für den Sync.',
          icon: GitBranch,
          note: 'Provider und Tokens',
        },
        {
          href: '/verwaltung/integrationen/ai',
          title: 'AI',
          description: 'Steuern Sie AI-Zugriff, Provider und den Wissensindex der Plattform an einem Ort.',
          icon: Bot,
          note: 'Modelle und Zugriff',
        },
      ]}
    />
  );
}