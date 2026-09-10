import { legacyAppointmentsRedirectPage } from "@/lib/products/appointments-legacy-redirect-page";

export default function VoiceRemindersPage() {
  return legacyAppointmentsRedirectPage({ pathname: "/appointments/voice-reminders" });
}
