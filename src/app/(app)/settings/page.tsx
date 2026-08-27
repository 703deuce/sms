import { redirect } from "next/navigation";

/** Settings nav — business profile, not billing. Billing is its own sidebar item. */
export default function SettingsIndexPage() {
  redirect("/settings/business");
}
