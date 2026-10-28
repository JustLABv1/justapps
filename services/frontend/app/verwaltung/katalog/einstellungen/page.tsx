import { Suspense } from "react";
import { AdminSettingsTabs } from "@/components/admin/AdminSettingsTabs";
import { AdminSettingsWorkspace } from "@/components/admin/AdminSettingsWorkspace";
export default function CatalogSettingsPage() {
  return (
    <Suspense fallback={<p role="status">Einstellungen werden geladen …</p>}>
      <AdminSettingsTabs
        title="Katalog konfigurieren"
        description="Sortierung, Link-Prüfung und die Struktur der App-Details. Zugriffs- und Erstellungsregeln finden Sie unter Zugriff & Berechtigungen."
        tabs={[
          {
            key: "darstellung",
            label: "Sortierung & Link-Prüfung",
            content: (
              <AdminSettingsWorkspace
                title="Katalogdarstellung"
                description=""
                sections={["apps"]}
                showHeading={false}
              />
            ),
          },
          {
            key: "felder",
            label: "Detailfelder",
            content: (
              <AdminSettingsWorkspace
                title="Detailfelder"
                description=""
                sections={["inhalte"]}
                showHeading={false}
              />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
