import { redirect } from "next/navigation";
import { appointmentRemindersShellHome } from "@/lib/appointment-reminders/routes";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";
import { AppointmentsCalendarClient } from "@/components/appointments/calendar-client";

export default function AppointmentsCalendarPage() {
  if (isUnifiedAppointmentsExperience()) redirect(appointmentRemindersShellHome());
  return <AppointmentsCalendarClient />;
}
