import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { JoinAccessError, findVideoMeetingForAppointment, requestStaffVideoJoin } from "@/lib/transovo-video/service";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);

    const { id: appointmentId } = await context.params;
    const meeting = await findVideoMeetingForAppointment(auth.workspaceId, appointmentId);
    if (!meeting) {
      return NextResponse.json({ error: "Video meeting not found" }, { status: 404 });
    }

    const result = await requestStaffVideoJoin({
      workspaceId: auth.workspaceId,
      appointmentId,
      userId: auth.session.userId,
      email: auth.session.email,
      name: auth.session.name,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof JoinAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
    }
    return jsonEntitlementError(err, 400);
  }
}
