/**
 * Read-only: audit latest PLATFORM outbound + resolver state for inbound reply cert.
 * Masks caller E.164 in output.
 *
 *   WORKSPACE_ID=ws_1 npx tsx scripts/audit-mctb-platform-inbound-production.ts
 */
import { getPrisma } from "@/lib/db";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  loadPlatformMctbReplyContexts,
  resolvePlatformMctbInboundReply,
} from "@/lib/mctb/messaging/platform-inbound-tenant-resolution";
import { MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS } from "@/lib/mctb/messaging/platform-sender-suppression";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";

const PLATFORM_E164 = "+18885046264";
const WS = process.env.WORKSPACE_ID?.trim() || "ws_1";

function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "(none)";
  const d = e164.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

async function main() {
  const prisma = getPrisma();
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) {
    console.log(JSON.stringify({ ok: false, error: "no_canonical_platform_sender" }, null, 2));
    process.exit(1);
  }

  const since = new Date(Date.now() - MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS);

  const missedEvents = await prisma.missedCallEvent.findMany({
    where: {
      workspaceId: WS,
      smsSentAt: { not: null, gte: since },
    },
    orderBy: { smsSentAt: "desc" },
    take: 5,
    select: {
      id: true,
      callerE164: true,
      smsSentAt: true,
      smsMessageId: true,
      metadata: true,
      status: true,
    },
  });

  const platformMissed = missedEvents.filter((e) => {
    const meta =
      e.metadata && typeof e.metadata === "object"
        ? (e.metadata as Record<string, unknown>)
        : {};
    const mode = String(meta.outboundSmsSenderMode || "");
    const from = String(meta.outboundSmsFromE164 || "");
    const pid = String(meta.outboundSmsPhoneNumberId || "");
    return (
      mode === "PLATFORM" ||
      from === PLATFORM_E164 ||
      pid === platform.phoneNumberId
    );
  });

  const latest = platformMissed[0] || null;
  let message: {
    id: string;
    workspaceId: string | null;
    from: string;
    to: string;
    providerId: string | null;
    createdAt: Date;
  } | null = null;

  if (latest?.smsMessageId) {
    message = await prisma.message.findUnique({
      where: { id: latest.smsMessageId },
      select: {
        id: true,
        workspaceId: true,
        from: true,
        to: true,
        providerId: true,
        createdAt: true,
      },
    });
  }

  if (!message) {
    const msgHits = await prisma.message.findMany({
      where: {
        workspaceId: WS,
        from: { in: [PLATFORM_E164, platform.e164] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        workspaceId: true,
        from: true,
        to: true,
        providerId: true,
        createdAt: true,
      },
    });
    message = msgHits[0] || null;
  }

  let conversationId: string | null = null;
  if (message?.providerId) {
    const cm = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: message.providerId },
      select: { conversationId: true },
    });
    conversationId = cm?.conversationId ?? null;
  }
  if (!conversationId && latest) {
    const conv = await prisma.conversation.findFirst({
      where: {
        workspaceId: WS,
        productSource: "MCTB",
        phoneNumberId: platform.phoneNumberId,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    conversationId = conv?.id ?? null;
  }

  const consumerE164 = latest?.callerE164 || message?.to || null;
  let resolution: unknown = null;
  let contexts: unknown = null;
  if (consumerE164) {
    contexts = await loadPlatformMctbReplyContexts({
      platformSender: platform,
      consumerE164,
    });
    resolution = await resolvePlatformMctbInboundReply({
      platformSender: platform,
      consumerE164,
    });
  }

  const mctbCfg = await loadMissedCallTextConfig(WS);
  const lrCfg = await loadLeadRecoveryConfig(WS);

  const meta =
    latest?.metadata && typeof latest.metadata === "object"
      ? (latest.metadata as Record<string, unknown>)
      : {};

  console.log(
    JSON.stringify(
      {
        ok: true,
        replyContextWindowMs: MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS,
        replyContextWindowDays: MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS / (24 * 60 * 60 * 1000),
        platformSender: {
          phoneNumberId: platform.phoneNumberId,
          e164: platform.e164,
          ownerWorkspaceId: platform.workspaceId,
        },
        customerWorkspaceId: WS,
        senderModeOnWorkspace: mctbCfg.senderMode,
        ws1IsolationWarning:
          platform.workspaceId === WS
            ? "customer workspace equals platform PhoneNumber.workspaceId — isolation not proven by this test alone"
            : null,
        latestPlatformMissedCallEvent: latest
          ? {
              id: latest.id,
              callerMasked: maskPhone(latest.callerE164),
              smsSentAt: latest.smsSentAt?.toISOString(),
              smsMessageId: latest.smsMessageId,
              status: latest.status,
              outboundSmsSenderMode: meta.outboundSmsSenderMode,
              outboundSmsFromE164: meta.outboundSmsFromE164,
              outboundSmsPhoneNumberId: meta.outboundSmsPhoneNumberId,
            }
          : null,
        outboundMessage: message
          ? {
              id: message.id,
              workspaceId: message.workspaceId,
              from: message.from,
              toMasked: maskPhone(message.to),
              providerMessageSid: message.providerId,
              createdAt: message.createdAt.toISOString(),
            }
          : null,
        conversationId,
        leadRecovery: {
          enabled: lrCfg.enabled,
          policyHealth: lrCfg.policyHealth,
          bookingMode: lrCfg.bookingMode,
          enabledIntents: lrCfg.enabledIntents,
          actionCapabilities: lrCfg.actionCapabilities,
        },
        resolver: {
          consumerMasked: maskPhone(consumerE164),
          resolution,
          candidateWorkspaceCount:
            Array.isArray(contexts)
              ? [...new Set((contexts as { workspaceId: string }[]).map((c) => c.workspaceId))].length
              : 0,
          contextsSummary: Array.isArray(contexts)
            ? (contexts as { workspaceId: string; conversationId: string | null; lastOutboundAt: Date }[]).map(
                (c) => ({
                  workspaceId: c.workspaceId,
                  conversationId: c.conversationId,
                  lastOutboundAt: c.lastOutboundAt.toISOString(),
                }),
              )
            : [],
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
