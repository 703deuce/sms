import { redirect } from "next/navigation";

/** Legacy Mass Texting overview — consolidated under /dashboard. */
export default function MassTextingOverviewRedirect() {
  redirect("/dashboard");
}
