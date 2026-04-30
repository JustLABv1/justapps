import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungPlattformGovernancePage() {
  return (
    <AdminSettingsWorkspace
      title="Regeln & Freigaben"
      description="Regelt zentrale Einreichungen und steuert, ob Benutzer eigene Apps in den Katalog einbringen dürfen."
      sections={['governance']}
    />
  );
}