import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungIntegrationenRepositoryProvidersPage() {
  return (
    <AdminSettingsWorkspace
      title="Repository-Provider"
      description="Verwalten Sie GitLab- und GitHub-Provider, Tokens und Standardpfade für die Synchronisation."
      sections={['integrationen']}
    />
  );
}