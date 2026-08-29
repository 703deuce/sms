import { redirect } from "next/navigation";

/** Integrations live under Settings in the SMS platform nav. */
export default function SettingsIntegrationsPage() {
  redirect("/integrations");
}
