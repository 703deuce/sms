import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function LegacyRoutingPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/routing" });
}
