import { AdminOverviewPage } from "@/components/admin/AdminOverviewPage";
import { adminNavGroups } from "@/lib/admin-navigation";
export default function AdminCategoryPage() {
  const items = adminNavGroups.find(
    (group) => group.label === "Betrieb",
  )!.items;
  return (
    <AdminOverviewPage
      title="Betrieb"
      description="Gesundheit der Apps, Aktivitätsprotokoll und Sicherungen im Blick behalten."
      cards={items.map((item) => ({
        href: item.href,
        title: item.label,
        description: item.description,
        icon: item.icon,
      }))}
    />
  );
}
