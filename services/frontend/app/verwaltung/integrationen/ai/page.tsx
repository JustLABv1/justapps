import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungIntegrationenAIPage() {
  return (
    <AdminSettingsWorkspace
      title="AI"
      description="Steuert globalen AI-Zugriff, anonyme Nutzung sowie die dahinterliegenden Provider und Indizes."
      sections={['ai']}
    />
  );
}