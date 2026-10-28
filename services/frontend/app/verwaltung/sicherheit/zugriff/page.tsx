import { Suspense } from "react";
import Link from "next/link";
import { AdminSettingsTabs } from "@/components/admin/AdminSettingsTabs";
import { AdminSettingsWorkspace } from "@/components/admin/AdminSettingsWorkspace";
import { OIDCProviderSettingsPanel } from "@/components/admin/OIDCProviderSettingsPanel";
import { RoleSettingsPanel } from "@/components/admin/RoleSettingsPanel";
export default function AccessSettingsPage() {
  return (
    <Suspense fallback={<p role="status">Einstellungen werden geladen …</p>}>
      <AdminSettingsTabs
        title="Zugriff & Berechtigungen"
        description="Ein zentraler Ort für globale Zugriffs- und Erstellungsregeln, Rollenrechte und Anmeldung. Individuelle Freigaben werden am Benutzerkonto vergeben."
        tabs={[
          {
            key: "regeln",
            label: "Globale Regeln",
            content: (
              <div className="space-y-5">
                <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  Globale Regeln legen fest, wer die Plattform nutzen und
                  Inhalte erstellen darf. Individuelle Ausnahmen verwalten Sie
                  unter{" "}
                  <Link
                    className="font-medium text-accent hover:underline"
                    href="/verwaltung/sicherheit/benutzer"
                  >
                    Benutzer & Freigaben
                  </Link>
                  .
                </p>
                <AdminSettingsWorkspace
                  title="Globale Regeln"
                  description=""
                  sections={["access", "governance", "ai-access"]}
                  showHeading={false}
                />
              </div>
            ),
          },
          {
            key: "rollen",
            label: "Rollen & Rechte",
            content: <RoleSettingsPanel />,
          },
          {
            key: "anmeldung",
            label: "Anmeldung & SSO",
            content: <OIDCProviderSettingsPanel />,
          },
        ]}
      />
    </Suspense>
  );
}
