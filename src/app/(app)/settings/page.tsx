import { redirect } from "next/navigation";

/** Personal sidebar links to /settings — default to billing. */
export default function SettingsIndexPage() {
  redirect("/settings/billing");
}
