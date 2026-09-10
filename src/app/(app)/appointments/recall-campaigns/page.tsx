import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function RecallCampaignsPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/recall-campaigns" });
}
