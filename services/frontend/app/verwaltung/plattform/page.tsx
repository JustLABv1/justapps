import { AdminOverviewPage } from '@/components/admin/AdminOverviewPage';
import { Globe, Paintbrush, ShieldCheck } from 'lucide-react';

export default function VerwaltungPlattformPage() {
  return (
    <AdminOverviewPage
      title="Plattform"
      description="Bündelt Plattformregeln, Startseiteninhalte und das visuelle Erscheinungsbild der Instanz."
      cards={[
        {
          href: '/verwaltung/plattform/governance',
          title: 'Governance',
          description: 'Regeln Sie Einreichungen und zentrale Freigaben für Beiträge zur Plattform.',
          icon: ShieldCheck,
          note: 'Regeln und Freigaben',
        },
        {
          href: '/verwaltung/plattform/startseite',
          title: 'Startseite',
          description: 'Pflegen Sie Top-Banner, Hero-Inhalte und die Hauptkommunikation auf der Einstiegsseite.',
          icon: Globe,
          note: 'Außenauftritt',
        },
        {
          href: '/verwaltung/plattform/branding',
          title: 'Branding',
          description: 'Verwalten Sie Name, Farben, Logos, Favicon und weitere Darstellungsmerkmale.',
          icon: Paintbrush,
          note: 'Marke und Design',
        },
      ]}
    />
  );
}