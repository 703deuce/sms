import { redirect } from "next/navigation";

/** Legacy route — canonical integrations page owns calendar connections. */
export default function CalendarIntegrationsRedirectPage() {
  redirect("/integrations?provider=calendar");
}
