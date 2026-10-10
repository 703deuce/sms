import { redirect } from "next/navigation";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

/** Calendar connection management lives under Settings → Integrations. */
export default function AppointmentRemindersCalendarsRedirect() {
  redirect(`${AR_ROUTES.settings}?tab=integrations`);
}
