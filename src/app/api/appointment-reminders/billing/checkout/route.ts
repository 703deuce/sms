import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { isArPlanKey, type ArPlanKey } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import { createAppointmentRemindersCheckoutSession } from "@/lib/appointment-reminders/commercial/stripe-checkout";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { plan?: string };
    const plan = String(body.plan || "").trim();
    if (!isArPlanKey(plan) || plan === "free") {
      return NextResponse.json({ error: "Invalid paid plan" }, { status: 400 });
    }
    const session = await createAppointmentRemindersCheckoutSession({
      workspaceId: auth.workspaceId,
      plan: plan as ArPlanKey,
    });
    return NextResponse.json({ data: session });
  } catch (err) {
    return jsonError(err, 400);
  }
}
