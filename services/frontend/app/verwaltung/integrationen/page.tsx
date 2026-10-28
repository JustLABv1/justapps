import { AdminOverviewPage } from "@/components/admin/AdminOverviewPage";
import { adminNavGroups } from "@/lib/admin-navigation";
export default function AdminCategoryPage() {
  const items = adminNavGroups.find(
    (group) => group.label === "Integrationen",
  )!.items;
  return (
    <AdminOverviewPage
      title="Integrationen"
      description="Technische Anbindungen und Provider konfigurieren. Nutzungs- und Zugriffsregeln finden Sie unter Zugriff & Berechtigungen."
      cards={items.map((item) => ({
        href: item.href,
        title: item.label,
        description: item.description,
        icon: item.icon,
      }))}
    />
  );
}
