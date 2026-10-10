import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { managePlatformProductSubscription } from "@/lib/products/platform-subscriptions";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { action?: string };
    const action = body.action;
    if (action !== "cancel_at_period_end" && action !== "resume") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    const result = await managePlatformProductSubscription({
      workspaceId: auth.workspaceId,
      productFamily: AR_PLATFORM_PRODUCT_FAMILY,
      action,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
