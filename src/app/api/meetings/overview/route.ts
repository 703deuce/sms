import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { hasAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { listMeetingSessions } from "@/lib/meeting-assistant/service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const notetakerEntitled = await hasAiNotetakerEntitlement(auth.workspaceId);
    if (!notetakerEntitled) {
      return NextResponse.json({
        data: {
          entitlements: { aiNotetaker: false },
          upcomingSessions: [],
          recentRecaps: [],
        },
      });
    }

    const [upcomingSessions, recentSessions] = await Promise.all([
      listMeetingSessions(auth.workspaceId, "upcoming", "external"),
      listMeetingSessions(auth.workspaceId, "past", "external"),
    ]);

    return NextResponse.json({
      data: {
        entitlements: { aiNotetaker: true },
        upcomingSessions: upcomingSessions.slice(0, 8).map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          meetingPlatform: s.meetingPlatform,
          meetingUrl: s.meetingUrl,
          scheduledStartAt: s.scheduledStartAt?.toISOString() || null,
        })),
        recentRecaps: recentSessions
          .filter((s) => s.status === "completed" || s.summaryStatus === "ready")
          .slice(0, 6)
          .map((s) => ({
            id: s.id,
            title: s.title,
            scheduledStartAt: s.scheduledStartAt?.toISOString() || null,
            meetingPlatform: s.meetingPlatform,
          })),
      },
    });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}
