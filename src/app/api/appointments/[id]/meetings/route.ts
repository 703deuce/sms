import { NextResponse } from "next/server";
import { jsonEntitlementError, jsonError, requireSession } from "@/lib/api-auth";
import { hasAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { hasTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import { getMeetingSessionsForAppointment } from "@/lib/meeting-assistant/service";
import { findVideoMeetingForAppointment } from "@/lib/transovo-video/service";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";
import { resolveMeetingUrlForAppointment } from "@/lib/meeting-assistant/meeting-url";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [notetakerEntitled, videoEntitled] = await Promise.all([
      hasAiNotetakerEntitlement(auth.workspaceId),
      hasTransovoVideoEntitlement(auth.workspaceId),
    ]);
    if (!notetakerEntitled && !videoEntitled) {
      return jsonEntitlementError(new Error("MEETINGS_NOT_ENTITLED"));
    }

    const { id: appointmentId } = await context.params;

    const { sessions } = await getMeetingSessionsForAppointment(auth.workspaceId, appointmentId);
    const videoMeeting = videoEntitled
      ? await findVideoMeetingForAppointment(auth.workspaceId, appointmentId)
      : null;

    const externalSession =
      notetakerEntitled
        ? sessions.find((s: { meetingSource?: string; enabled?: boolean }) => s.meetingSource !== "transovo_video" && s.enabled) ||
          sessions.find((s: { meetingSource?: string }) => s.meetingSource !== "transovo_video") ||
          null
        : null;

    const videoSession =
      videoEntitled
        ? sessions.find((s: { meetingSource?: string }) => s.meetingSource === "transovo_video") || null
        : null;

    const { getPrisma } = await import("@/lib/db");
    const appt = await getPrisma().voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId: auth.workspaceId },
    });
    const meta = (appt?.metadata || {}) as Record<string, unknown>;
    const resolvedMeetingUrl = notetakerEntitled
      ? resolveMeetingUrlForAppointment(
          meta as import("@/lib/appointments/types").AppointmentMetadata,
        )
      : null;

    return NextResponse.json({
      data: {
        externalSession,
        videoSession,
        videoMeeting: videoMeeting
          ? {
              ...videoMeeting,
              meetingUrl: publicVideoMeetingUrl(videoMeeting.publicMeetingToken),
            }
          : null,
        resolvedMeetingUrl,
        notetakerEnabled: Boolean(meta.notetakerEnabled),
      },
    });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
