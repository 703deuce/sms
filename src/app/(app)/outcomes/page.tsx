import { redirect } from "next/navigation";

/** Legacy route — consolidated under /dashboard. */
export default function OutcomesRedirectPage() {
  redirect("/dashboard");
}
