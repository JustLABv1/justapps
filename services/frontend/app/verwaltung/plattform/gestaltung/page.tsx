import { Suspense } from "react";
import { AdminSettingsTabs } from "@/components/admin/AdminSettingsTabs";
import { AdminSettingsWorkspace } from "@/components/admin/AdminSettingsWorkspace";
export default function AppearanceSettingsPage() {
  return (
    <Suspense fallback={<p role="status">Einstellungen werden geladen …</p>}>
      <AdminSettingsTabs
        title="Erscheinungsbild"
        description="Name, Farben, Logos, Startseiteninhalte und Footer gemeinsam konfigurieren."
        tabs={[
          {
            key: "marke",
            label: "Marke & Farben",
            content: (
              <AdminSettingsWorkspace
                title="Marke & Farben"
                description=""
                sections={["branding"]}
                showHeading={false}
              />
            ),
          },
          {
            key: "startseite",
            label: "Startseite & Banner",
            content: (
              <AdminSettingsWorkspace
                title="Startseite"
                description=""
                sections={["startseite"]}
                showHeading={false}
              />
            ),
          },
          {
            key: "footer",
            label: "Footer & Links",
            content: (
              <AdminSettingsWorkspace
                title="Footer"
                description=""
                sections={["footer"]}
                showHeading={false}
              />
            ),
          },
        ]}
      />
    </Suspense>
  );
}
