import { redirect } from "next/navigation";
export default function LegacySettingsRedirect() {
  redirect("/verwaltung/plattform/gestaltung");
}
