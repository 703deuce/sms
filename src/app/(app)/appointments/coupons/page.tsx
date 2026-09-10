import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function CouponsPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/coupons" });
}
