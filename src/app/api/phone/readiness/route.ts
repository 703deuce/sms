import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { isTelnyxPhoneConfigured } from "@/lib/phone/human-call-service";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

/**
 * Server-side phone readiness signals for the Phone Readiness Test.
 * Client merges these with browser permission / network checks.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const workspaceId = auth.workspaceId;

    const [numbers, presence, settings, recentCall, pushSubs] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { workspaceId },
        select: { id: true, e164: true, status: true },
        take: 50,
      }),
      prisma.softphonePresence.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: auth.session.userId },
        },
      }),
      prisma.softphoneUserSettings.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: auth.session.userId },
        },
      }),
      prisma.humanCall.findFirst({
        where: { workspaceId, agentUserId: auth.session.userId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          answeredAt: true,
          mediaMode: true,
        },
      }),
      prisma.pushSubscription.count({
        where: { workspaceId, userId: auth.session.userId },
      }),
    ]);

    const telnyxConfigured = isTelnyxPhoneConfigured();
    const publicKeyPresent = Boolean(process.env.TELNYX_PUBLIC_KEY?.trim());
    const connectionId = Boolean(process.env.TELNYX_CONNECTION_ID?.trim());
    const apiKey = Boolean(getTelnyxApiKey());
    const activeNumbers = numbers.filter((n: { status: string }) =>
      /active|in[-_]?use|assigned/i.test(n.status || "active"),
    );

    return NextResponse.json({
      data: {
        checkedAt: new Date().toISOString(),
        telnyx: {
          apiKey,
          connectionId,
          publicKeyPresent,
          phoneConfigured: telnyxConfigured,
        },
        numbers: {
          activeCount: activeNumbers.length || numbers.length,
          sample: (activeNumbers.length ? activeNumbers : numbers).slice(0, 5),
        },
        presence: presence
          ? {
              status: presence.status,
              queueAvailable: presence.queueAvailable,
              updatedAt: presence.updatedAt,
              deviceIds: presence.deviceIds || [],
            }
          : null,
        userSettings: settings
          ? {
              dndEnabled: settings.dndEnabled,
              ringDesktop: settings.ringDesktop,
              ringMobile: settings.ringMobile,
              recordingEnabled: settings.recordingEnabled,
              internationalEnabled: settings.internationalEnabled,
              hasCellularForward: Boolean(settings.forwardToCellular),
            }
          : null,
        lastCall: recentCall,
        pushSubscriptionCount: pushSubs,
        checks: {
          hasActiveNumber: numbers.length > 0 || activeNumbers.length > 0,
          telnyxReady: telnyxConfigured && publicKeyPresent,
          notInDnd: !(settings?.dndEnabled || presence?.status === "dnd"),
          presenceFresh: presence
            ? Date.now() - new Date(presence.updatedAt).getTime() < 15 * 60_000
            : false,
          // Softphone call push not yet wired — surface honestly.
          incomingCallPush: false,
        },
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
