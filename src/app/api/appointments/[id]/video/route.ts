import { NextResponse } from "next/server";
import { jsonEntitlementError, jsonError, requireSession } from "@/lib/api-auth";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import { findVideoMeetingForAppointment } from "@/lib/transovo-video/service";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const { id } = await context.params;
    const meeting = await findVideoMeetingForAppointment(auth.workspaceId, id);
    if (!meeting) return NextResponse.json({ data: { meeting: null } });
    return NextResponse.json({
      data: {
        meeting: {
          ...meeting,
          meetingUrl: publicVideoMeetingUrl(meeting.publicMeetingToken),
        },
      },
    });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
