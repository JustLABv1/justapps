import { AdminSettingsWorkspace } from "@/components/admin/AdminSettingsWorkspace";

export default function VerwaltungIntegrationenAIPage() {
  return (
    <AdminSettingsWorkspace
      title="KI-Provider & Modelle"
      description="Konfigurieren Sie KI-Provider, Modelle und den Wissensindex. Die Nutzungsregeln liegen zentral unter Zugriff & Berechtigungen."
      sections={["ai"]}
    />
  );
}
