import { AdminOverviewPage } from '@/components/admin/AdminOverviewPage';
import { Activity, Archive, KeyRound, Users } from 'lucide-react';

export default function VerwaltungSicherheitPage() {
  return (
    <AdminOverviewPage
      title="Sicherheit"
      description="Konzentriert Benutzerzugänge, Nachvollziehbarkeit, Tokenverwaltung und Wiederherstellung auf einer Ebene."
      cards={[
        {
          href: '/verwaltung/sicherheit/benutzer',
          title: 'Benutzer',
          description: 'Verwalten Sie Konten, Rollen und administrative Zugriffsrechte.',
          icon: Users,
          note: 'Konten und Rollen',
        },
        {
          href: '/verwaltung/sicherheit/tokens',
          title: 'Tokens',
          description: 'Pflegen Sie Zugriffstoken und kontrollieren Sie deren Einsatz in der Plattform.',
          icon: KeyRound,
          note: 'API und Zugriffe',
        },
        {
          href: '/verwaltung/sicherheit/audit',
          title: 'Audit',
          description: 'Verfolgen Sie Änderungen, Systemereignisse und administrative Aktivitäten nach.',
          icon: Activity,
          note: 'Nachvollziehbarkeit',
        },
        {
          href: '/verwaltung/sicherheit/backups',
          title: 'Backups',
          description: 'Erstellen und importieren Sie Sicherungen für Wiederherstellung und Migration.',
          icon: Archive,
          note: 'Sicherung und Restore',
        },
      ]}
    />
  );
}