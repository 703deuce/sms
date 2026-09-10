import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function BookingShareHubPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/booking/share" });
}
