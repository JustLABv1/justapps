import { AdminOverviewPage } from "@/components/admin/AdminOverviewPage";
import { adminNavGroups } from "@/lib/admin-navigation";
export default function AdminCategoryPage() {
  const items = adminNavGroups.find(
    (group) => group.label === "Benutzer & Zugriff",
  )!.items;
  return (
    <AdminOverviewPage
      title="Benutzer & Zugriff"
      description="Globale Zugriffsregeln und Rollenrechte an einem Ort; individuelle Freigaben direkt am Benutzerkonto."
      cards={items.map((item) => ({
        href: item.href,
        title: item.label,
        description: item.description,
        icon: item.icon,
      }))}
    />
  );
}
