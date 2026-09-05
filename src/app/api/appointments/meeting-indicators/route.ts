import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { getAppointmentMeetingIndicators } from "@/lib/appointments/meeting-indicators";
import { hasAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { hasTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [notetakerEntitled, videoEntitled] = await Promise.all([
      hasAiNotetakerEntitlement(auth.workspaceId),
      hasTransovoVideoEntitlement(auth.workspaceId),
    ]);
    if (!notetakerEntitled && !videoEntitled) {
      return NextResponse.json({ data: {} });
    }

    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) {
      return NextResponse.json({ data: {} });
    }

    const indicators = await getAppointmentMeetingIndicators(auth.workspaceId, ids);
    const filtered = Object.fromEntries(
      Object.entries(indicators).map(([appointmentId, row]) => {
        const next = { ...row };
        if (!notetakerEntitled) {
          delete next.notetakerStatus;
          delete next.notetakerSessionId;
          delete next.notetakerEnabled;
        }
        if (!videoEntitled) {
          delete next.videoStatus;
          delete next.videoProvisioningStatus;
          delete next.videoMeetingId;
          delete next.videoJoinUrl;
        }
        if (!notetakerEntitled && !videoEntitled) {
          delete next.recapReady;
          delete next.recapSessionId;
        }
        return [appointmentId, next];
      }),
    );

    return NextResponse.json({ data: filtered });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
