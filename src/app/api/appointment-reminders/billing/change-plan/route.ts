import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { isArPlanKey, type ArPlanKey } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  changeAppointmentRemindersSubscriptionPlan,
  createAppointmentRemindersCheckoutSession,
} from "@/lib/appointment-reminders/commercial/stripe-checkout";
import { getPrisma } from "@/lib/db";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { plan?: string };
    const plan = String(body.plan || "").trim();
    if (!isArPlanKey(plan) || plan === "free") {
      return NextResponse.json({ error: "Invalid upgrade plan" }, { status: 400 });
    }

    const sub = await getPrisma().platformProductSubscription.findUnique({
      where: {
        workspaceId_productFamily: {
          workspaceId: auth.workspaceId,
          productFamily: AR_PLATFORM_PRODUCT_FAMILY,
        },
      },
    });

    if (sub && ACTIVE.has(sub.status)) {
      await changeAppointmentRemindersSubscriptionPlan({
        workspaceId: auth.workspaceId,
        plan: plan as ArPlanKey,
      });
      return NextResponse.json({ data: { upgraded: true, plan } });
    }

    const session = await createAppointmentRemindersCheckoutSession({
      workspaceId: auth.workspaceId,
      plan: plan as ArPlanKey,
    });
    return NextResponse.json({ data: { checkout: session } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
