import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungIntegrationenAuthPage() {
  return (
    <AdminSettingsWorkspace
      title="Authentifizierung"
      description="Verwalten Sie OIDC-Provider und steuern Sie, ob der App Store nur für authentifizierte Nutzer erreichbar ist."
      sections={['auth']}
    />
  );
}
