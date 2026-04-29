import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungPlattformBrandingPage() {
  return (
    <AdminSettingsWorkspace
      title="Branding"
      description="Verwalten Sie Store-Name, Logos, Favicon und Akzentfarben als Teil des Plattformauftritts."
      sections={['branding']}
    />
  );
}