import { NextResponse } from "next/server";
import type { DbRow } from "@/lib/db";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { hasAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { listMeetingSessions } from "@/lib/meeting-assistant/service";
import { hasTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import { listVideoMeetings } from "@/lib/transovo-video/service";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [videoEntitled, notetakerEntitled] = await Promise.all([
      hasTransovoVideoEntitlement(auth.workspaceId),
      hasAiNotetakerEntitlement(auth.workspaceId),
    ]);

    const [videoMeetings, sessions] = await Promise.all([
      videoEntitled ? listVideoMeetings(auth.workspaceId, "upcoming") : [],
      notetakerEntitled ? listMeetingSessions(auth.workspaceId, "upcoming", "all") : [],
    ]);

    const recentSessions = notetakerEntitled
      ? await listMeetingSessions(auth.workspaceId, "past", "all")
      : [];

    return NextResponse.json({
      data: {
        entitlements: {
          transovoVideo: videoEntitled,
          aiNotetaker: notetakerEntitled,
        },
        upcomingVideoMeetings: videoMeetings.map((m: DbRow) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          scheduledStartAt: m.scheduledStartAt?.toISOString() || null,
          publicMeetingToken: m.publicMeetingToken,
          meetingUrl: publicVideoMeetingUrl(m.publicMeetingToken),
          hostJoinUrl: `/video/rooms/${m.id}/host`,
          appointmentId: m.appointmentId,
        })),
        upcomingSessions: sessions.slice(0, 8).map((s: DbRow) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          meetingSource: s.meetingSource,
          meetingPlatform: s.meetingPlatform,
          meetingUrl: s.meetingUrl,
          scheduledStartAt: s.scheduledStartAt?.toISOString() || null,
          appointmentId: s.appointmentId,
          videoMeetingId: s.videoMeetingId,
          summaryStatus: s.summaryStatus,
          recordingStatus: s.recordingStatus,
        })),
        recentRecaps: recentSessions
          .filter((s: DbRow) => s.status === "completed" || s.summaryStatus === "ready")
          .slice(0, 6)
          .map((s: DbRow) => ({
            id: s.id,
            title: s.title,
            scheduledStartAt: s.scheduledStartAt?.toISOString() || null,
            meetingSource: s.meetingSource,
          })),
      },
    });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
