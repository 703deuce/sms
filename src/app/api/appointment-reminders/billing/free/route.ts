import { NextResponse } from "next/server";
import { jsonError, requireSession } from "@/lib/api-auth";
import { assignArFreePlan } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { resolveArWorkspaceCommercial } from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { getPrisma } from "@/lib/db";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function POST() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const existingSub = await getPrisma().platformProductSubscription.findUnique({
      where: {
        workspaceId_productFamily: {
          workspaceId: auth.workspaceId,
          productFamily: AR_PLATFORM_PRODUCT_FAMILY,
        },
      },
    });
    if (existingSub && ACTIVE.has(existingSub.status) && existingSub.tier !== "free") {
      return NextResponse.json(
        { error: "This workspace already has a paid Appointment Reminders subscription." },
        { status: 409 },
      );
    }

    await assignArFreePlan(auth.workspaceId);
    const commercial = await resolveArWorkspaceCommercial(auth.workspaceId);
    return NextResponse.json({
      data: {
        planKey: commercial.planKey,
        hasProductAccess: commercial.hasProductAccess,
        nextPath: "/appointment-reminders/setup/connect",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
