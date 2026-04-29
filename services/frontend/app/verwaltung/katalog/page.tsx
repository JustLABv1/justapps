import { AdminOverviewPage } from '@/components/admin/AdminOverviewPage';
import { ExternalLink, Layers, Layers2, SortAsc } from 'lucide-react';

export default function VerwaltungKatalogPage() {
  return (
    <AdminOverviewPage
      title="Katalog"
      description="Steuert den Anwendungsbestand, Gruppenstrukturen und die fachliche Darstellung des App-Katalogs."
      cards={[
        {
          href: '/verwaltung/katalog/apps',
          title: 'Apps',
          description: 'Verwalten Sie den gesamten App-Bestand, bearbeiten Sie Einträge und legen Sie neue Apps an.',
          icon: Layers,
          note: 'Bestand und Bearbeitung',
        },
        {
          href: '/verwaltung/katalog/gruppen',
          title: 'Gruppen',
          description: 'Pflegen Sie App-Gruppen, Mitgliedschaften und Strukturierung für Sammlungen.',
          icon: Layers2,
          note: 'Kategorien und Cluster',
        },
        {
          href: '/verwaltung/katalog/inhalte',
          title: 'Inhalte',
          description: 'Definieren Sie Detailfelder und Footer-Links, die den Kataloginhalt und Metadaten strukturieren.',
          icon: ExternalLink,
          note: 'Felder und Metadaten',
        },
        {
          href: '/verwaltung/katalog/app-verhalten',
          title: 'App-Verhalten',
          description: 'Konfigurieren Sie Standards für Sortierung, Pinning und Link-Prüfung im Katalog.',
          icon: SortAsc,
          note: 'Reihenfolge und Regeln',
        },
      ]}
    />
  );
}