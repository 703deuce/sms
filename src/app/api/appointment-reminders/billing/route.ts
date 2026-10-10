import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadArBillingSnapshot } from "@/lib/appointment-reminders/commercial/ar-billing-snapshot";
import { stripeBillingMode } from "@/lib/products/platform-billing-catalog";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const snapshot = await loadArBillingSnapshot(auth.workspaceId);
    return NextResponse.json({
      data: snapshot,
      stripeMode: stripeBillingMode(),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
