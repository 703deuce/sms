import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { enableNotetakerForAppointment } from "@/lib/meeting-assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const body = await request.json();
    const appointmentId = String(body.appointmentId || "");
    if (!appointmentId) throw new Error("appointmentId required");
    const data = await enableNotetakerForAppointment({
      workspaceId: auth.workspaceId,
      appointmentId,
      meetingUrl: body.meetingUrl ? String(body.meetingUrl) : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
