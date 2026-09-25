/**
 * Diagnose ws_1 MCTB press-1 without SMS (read-only).
 */
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveMctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";

const WS = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId: WS, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      callerE164: true,
      recoveryState: true,
      consentState: true,
      smsSentAt: true,
      suppressionReason: true,
      metadata: true,
      phoneNumberId: true,
    },
  });

  const cfg = await loadMissedCallTextConfig(WS);
  const platform = await resolveCanonicalMctbPlatformSender();

  let routePreview: unknown = null;
  if (cfg) {
    try {
      routePreview = await resolveMctbOutboundSmsRoute({
        workspaceId: WS,
        config: cfg,
      });
    } catch (e) {
      routePreview = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const recentMessages = await prisma.message.findMany({
    where: { workspaceId: WS, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      createdAt: true,
      to: true,
      from: true,
      status: true,
      errorMessage: true,
      providerMessageId: true,
      campaignId: true,
    },
  });

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { workspaceId: WS, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, createdAt: true, eventType: true, detail: true, missedCallEventId: true },
  });

  console.log(
    JSON.stringify(
      {
        workspaceId: WS,
        since: since.toISOString(),
        mctbConfig: cfg
          ? {
              enabled: cfg.enabled,
              senderMode: cfg.senderMode,
              phoneNumberId: cfg.phoneNumberId,
              smsPhoneNumberId: cfg.smsPhoneNumberId,
              consentMode: cfg.consentMode,
            }
          : null,
        platformSenderEnv: process.env.MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID || null,
        canonicalPlatformSender: platform,
        outboundRoutePreview: routePreview,
        recentMissedCallEvents: events,
        recentOutboundMessages: recentMessages,
        recentTraces: traces,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
