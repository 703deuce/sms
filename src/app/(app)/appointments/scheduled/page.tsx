import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function ScheduledAppointmentsPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/scheduled" });
}
