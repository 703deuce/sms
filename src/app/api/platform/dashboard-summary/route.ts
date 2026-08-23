import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = auth.workspaceId;
    const prisma = getPrisma();

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const sinceToday = new Date();
    sinceToday.setHours(0, 0, 0, 0);

    const features = await getWorkspaceProductFeatures(workspaceId);

    const [
      missedToday,
      sentToday,
      repliedToday,
      missed30d,
      srSessions30d,
      voicemailsUnread,
      callbacksOpen,
      linkClicks30d,
      formSubs30d,
    ] = await Promise.all([
      prisma.missedCallEvent.count({
        where: { workspaceId, detectedAt: { gte: sinceToday } },
      }),
      prisma.missedCallEvent.count({
        where: { workspaceId, smsSentAt: { gte: sinceToday } },
      }),
      prisma.missedCallEvent.count({
        where: { workspaceId, status: "CUSTOMER_REPLIED", detectedAt: { gte: sinceToday } },
      }),
      prisma.missedCallEvent.count({
        where: { workspaceId, detectedAt: { gte: since30 } },
      }),
      prisma.smartRoutingCallSession.count({
        where: { workspaceId, startedAt: { gte: since30 } },
      }),
      prisma.voicemailMessage.count({
        where: { workspaceId, isRead: false },
      }),
      prisma.callbackRequest.count({
        where: { workspaceId, status: { in: ["new", "contacted"] } },
      }).catch(() => 0),
      prisma.linkClickEvent.count({
        where: { workspaceId, createdAt: { gte: since30 } },
      }),
      prisma.mctbRequestFormSubmission.count({
        where: { workspaceId, submittedAt: { gte: since30 } },
      }).catch(() => 0),
    ]);

    const cards = [];

    if (isActiveEntitlement(features.mctb)) {
      cards.push({
        product: "mctb",
        title: "Missed Call Text Back",
        href: "/voice/missed-calls",
        metrics: [
          { label: "Missed today", value: missedToday },
          { label: "Texts sent today", value: sentToday },
          { label: "Replies today", value: repliedToday },
          { label: "Link clicks (30d)", value: linkClicks30d },
        ],
      });
    }

    if (isActiveEntitlement(features.smart_routing)) {
      cards.push({
        product: "smart_routing",
        title: "Smart Routing",
        href: "/smart-routing",
        metrics: [
          { label: "Calls routed (30d)", value: srSessions30d },
        ],
      });
    }

    if (isActiveEntitlement(features.visual_voicemail)) {
      cards.push({
        product: "visual_voicemail",
        title: "Visual Voicemail",
        href: "/personal/voicemail",
        metrics: [{ label: "Unread", value: voicemailsUnread }],
      });
    }

    if (isActiveEntitlement(features.callback_requests)) {
      cards.push({
        product: "callback_requests",
        title: "Callback Requests",
        href: "/voice/callback-requests",
        metrics: [{ label: "Open", value: callbacksOpen }],
      });
    }

    return NextResponse.json({
      data: {
        features,
        cards,
        summary: {
          missed30d,
          linkClicks30d,
          formSubmissions30d: formSubs30d,
        },
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
