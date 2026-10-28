import { AdminOverviewPage } from "@/components/admin/AdminOverviewPage";
import { adminNavGroups } from "@/lib/admin-navigation";
export default function AdminCategoryPage() {
  const items = adminNavGroups.find(
    (group) => group.label === "Katalog",
  )!.items;
  return (
    <AdminOverviewPage
      title="Katalog"
      description="Verwalten Sie Apps, private Spaces und App-Gruppen. Die Katalogdarstellung konfigurieren Sie gesammelt unter Katalog konfigurieren."
      cards={items.map((item) => ({
        href: item.href,
        title: item.label,
        description: item.description,
        icon: item.icon,
      }))}
    />
  );
}
