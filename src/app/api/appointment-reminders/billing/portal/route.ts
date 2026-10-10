import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { createAppointmentRemindersBillingPortalSession } from "@/lib/appointment-reminders/commercial/stripe-checkout";

export async function POST() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const url = await createAppointmentRemindersBillingPortalSession(auth.workspaceId);
    return NextResponse.json({ data: { url } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
