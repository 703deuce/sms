import { redirect } from "next/navigation";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

export default function LegacyAppointmentRemindersRedirect() {
  redirect(AR_ROUTES.settings);
}
