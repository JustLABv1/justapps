import { redirect } from "next/navigation";
export default function AuthSettingsRedirect() {
  redirect("/verwaltung/sicherheit/zugriff?bereich=anmeldung");
}
