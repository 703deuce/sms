import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function NoShowRecoveryPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/no-show-recovery" });
}
