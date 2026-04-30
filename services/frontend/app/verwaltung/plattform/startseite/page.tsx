import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungPlattformStartseitePage() {
  return (
    <AdminSettingsWorkspace
      title="Startseite"
      description="Pflegt Banner, Hero-Inhalte und den sichtbaren Auftritt der Plattform-Startseite."
      sections={['startseite']}
    />
  );
}