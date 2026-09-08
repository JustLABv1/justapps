import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungPlattformGovernancePage() {
  return (
    <AdminSettingsWorkspace
      title="Regeln & Freigaben"
      description="Regelt zentrale Einreichungen und steuert Community-Funktionen wie die FAQ in den App-Details."
      sections={['governance']}
    />
  );
}
