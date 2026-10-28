import { redirect } from "next/navigation";
export default function LegacySettingsRedirect() {
  redirect("/verwaltung/sicherheit/zugriff");
}
