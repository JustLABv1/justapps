import { AdminSettingsWorkspace } from '../../einstellungen/page';

export default function VerwaltungKatalogInhaltePage() {
  return (
    <AdminSettingsWorkspace
      title="Inhalte"
      description="Strukturiert fachliche Detailfelder und Footer-Links, die im Katalog und auf App-Seiten sichtbar sind."
      sections={['inhalte']}
    />
  );
}