import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungKatalogAppVerhaltenPage() {
  return (
    <AdminSettingsWorkspace
      title="App-Verhalten"
      description="Legt Standards für Katalogsortierung, angepinnte Apps und die Link-Prüfung von Live-Demos fest."
      sections={['apps']}
    />
  );
}