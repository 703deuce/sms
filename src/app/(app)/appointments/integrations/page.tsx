import { redirect } from "next/navigation";

export default function AppointmentIntegrationsRedirectPage() {
  redirect("/integrations/calendars");
}
