/**
 * Pass 3 evidence collector — pulls provider IDs, consent, delivery, STOP/START, dedupe.
 */
import { getPrisma } from "@/lib/db";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";

export type Pass3Evidence = {
  collectedAt: string;
  workspaceId: string;
  platformE164: string;
  demo: Awaited<ReturnType<typeof getDemoStatus>>;
  trialSegments: { used: number; limit: number | null };
  voiceCalls: Array<{
    id: string;
    telnyxCallControlId: string | null;
    fromE164: string | null;
    toE164: string | null;
    status: string;
    startedAt: Date;
    events: Array<{ eventType: string; providerEventId: string | null; createdAt: Date }>;
  }>;
  consentEvents: Array<{
    id: string;
    callerNumber: string;
    businessNumber: string;
    affirmativeInput: string;
    promptAssetId: string | null;
    promptVersion: string | null;
    consentedAt: Date;
  }>;
  missedCallEvents: Array<{
    id: string;
    callerE164: string;
    businessE164: string;
    status: string;
    suppressionReason: string | null;
    smsMessageId: string | null;
    smsSentAt: Date | null;
    metadata: unknown;
  }>;
  outboundMessages: Array<{
    id: string;
    from: string;
    to: string;
    status: string;
    providerId: string | null;
    idempotencyKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  inboundConversationMessages: Array<{
    id: string;
    conversationId: string;
    body: string;
    providerMessageId: string | null;
    createdAt: Date;
    workspaceId: string;
  }>;
  suppressions: Array<{ phone: string; reason: string | null; createdAt: Date }>;
  duplicateProviderIds: Array<{ providerMessageId: string; count: number }>;
  smartRoutingCallSessions: Array<{
    id: string;
    finalOutcome: string | null;
    callerNumber: string;
    calledNumber: string;
    startedAt: Date;
    smsTriggered: boolean;
  }>;
  checklist: Record<string, boolean>;
};

function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 7) return e164;
  return `***${d.slice(-4)}`;
}

export async function collectPass3Evidence(input: {
  workspaceId: string;
  sinceHours?: number;
}): Promise<Pass3Evidence> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - (input.sinceHours ?? 24) * 60 * 60 * 1000);
  const platformOwnerId = await resolvePlatformDemoOwnerWorkspaceId();

  const demo = await getDemoStatus(input.workspaceId);
  const entitlement = await getMctbEntitlement(input.workspaceId);

  const voiceCalls = await prisma.voiceCall.findMany({
    where: {
      OR: [
        { workspaceId: input.workspaceId, startedAt: { gte: since } },
        ...(platformOwnerId
          ? [{ workspaceId: platformOwnerId, toE164: MCTB_PLATFORM_DEMO_E164, startedAt: { gte: since } }]
          : []),
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      telnyxCallControlId: true,
      fromE164: true,
      toE164: true,
      status: true,
      startedAt: true,
      events: {
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { eventType: true, providerEventId: true, createdAt: true },
      },
    },
  });

  const consentEvents = await prisma.smartRoutingSmsConsentEvent.findMany({
    where: { workspaceId: input.workspaceId, consentedAt: { gte: since } },
    orderBy: { consentedAt: "desc" },
    take: 10,
  });

  const missedCallEvents = await prisma.missedCallEvent.findMany({
    where: { workspaceId: input.workspaceId, detectedAt: { gte: since } },
    orderBy: { detectedAt: "desc" },
    take: 10,
    select: {
      id: true,
      callerE164: true,
      businessE164: true,
      status: true,
      suppressionReason: true,
      smsMessageId: true,
      smsSentAt: true,
      metadata: true,
    },
  });

  const outboundMessages = await prisma.message.findMany({
    where: { workspaceId: input.workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      from: true,
      to: true,
      status: true,
      providerId: true,
      idempotencyKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const inboundConversationMessages = await prisma.conversationMessage.findMany({
    where: {
      direction: "inbound",
      createdAt: { gte: since },
      conversation: { workspaceId: input.workspaceId },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      conversationId: true,
      body: true,
      providerMessageId: true,
      createdAt: true,
      conversation: { select: { workspaceId: true } },
    },
  });

  const suppressions = await prisma.suppression.findMany({
    where: { workspaceId: input.workspaceId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { phone: true, reason: true, createdAt: true },
  });

  const idCounts = new Map<string, number>();
  for (const m of inboundConversationMessages) {
    if (!m.providerMessageId) continue;
    idCounts.set(m.providerMessageId, (idCounts.get(m.providerMessageId) || 0) + 1);
  }
  const duplicateProviderIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([providerMessageId, count]) => ({ providerMessageId, count }));

  const smartRoutingCallSessions = await prisma.smartRoutingCallSession.findMany({
    where: {
      workspaceId: { in: [input.workspaceId, ...(platformOwnerId ? [platformOwnerId] : [])] },
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true,
      finalOutcome: true,
      callerNumber: true,
      calledNumber: true,
      startedAt: true,
      smsTriggered: true,
    },
  });

  const demoOnlyEvents = missedCallEvents.filter((e) => {
    const meta = e.metadata as Record<string, unknown> | null;
    return meta?.demoMode === true;
  });
  const hasDelivered = outboundMessages.some((m) => m.status === "delivered");
  const hasSent = outboundMessages.some((m) =>
    ["sent", "delivered", "queued", "sending"].includes(m.status),
  );

  const checklist = {
    telnyx_call_id: voiceCalls.some((c) => Boolean(c.telnyxCallControlId)),
    dtmf_press_1_consent: consentEvents.some((c) => c.affirmativeInput === "1"),
    consent_record_with_prompt: consentEvents.some((c) => c.promptAssetId && c.promptVersion),
    outbound_sms_from_571: outboundMessages.some(
      (m) => m.from.replace(/\D/g, "") === MCTB_PLATFORM_DEMO_E164.replace(/\D/g, ""),
    ),
    telnyx_message_id: outboundMessages.some(
      (m) => m.providerId && !m.providerId.startsWith("pending:") && !m.providerId.startsWith("idem:"),
    ),
    delivery_status: hasDelivered || hasSent,
    inbound_reply_webhook: inboundConversationMessages.length > 0,
    conversation_created: inboundConversationMessages.length > 0,
    stop_suppression: suppressions.some((s) => String(s.reason || "").toUpperCase().includes("STOP")),
    demo_wizard_updated: Boolean(demo.checks.textDelivered && demo.checks.replyReceived),
    demo_events_only_for_segment_check:
      demoOnlyEvents.length === 0 || demoOnlyEvents.every((e) => e.status === "SENT" || e.status === "SUPPRESSED"),
    webhook_dedupe_clean: duplicateProviderIds.length === 0,
  };

  return {
    collectedAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    platformE164: MCTB_PLATFORM_DEMO_E164,
    demo,
    trialSegments: {
      used: entitlement.trialSmsSegmentsUsed,
      limit: entitlement.trialSmsSegmentLimit,
    },
    voiceCalls: voiceCalls.map((c) => ({
      ...c,
      fromE164: c.fromE164 ? maskPhone(c.fromE164) : null,
      toE164: c.toE164 ? maskPhone(c.toE164) : null,
    })),
    consentEvents,
    missedCallEvents: missedCallEvents.map((e) => ({ ...e, callerE164: maskPhone(e.callerE164) })),
    outboundMessages,
    inboundConversationMessages: inboundConversationMessages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      body: m.body,
      providerMessageId: m.providerMessageId,
      createdAt: m.createdAt,
      workspaceId: m.conversation.workspaceId,
    })),
    suppressions: suppressions.map((s) => ({ ...s, phone: maskPhone(s.phone) })),
    duplicateProviderIds,
    smartRoutingCallSessions,
    checklist,
  };
}

export function printPass3Evidence(evidence: Pass3Evidence) {
  console.log("\n── Pass 3 evidence ──\n");
  console.log(`Collected: ${evidence.collectedAt}`);
  console.log(`Workspace: ${evidence.workspaceId}`);
  console.log(`Platform:  ${evidence.platformE164}\n`);

  console.log("Demo wizard:");
  console.log(`  call: ${evidence.demo.checks.callDetected}`);
  console.log(`  text: ${evidence.demo.checks.textDelivered}`);
  console.log(`  reply: ${evidence.demo.checks.replyReceived}`);
  console.log(
    `Trial segments used: ${evidence.trialSegments.used} / ${evidence.trialSegments.limit ?? "∞"}`,
  );
  console.log("(Demo traffic should not increment trial segments.)\n");

  console.log("Checklist:");
  for (const [key, ok] of Object.entries(evidence.checklist)) {
    console.log(`  ${ok ? "✅" : "⬜"} ${key}`);
  }

  if (evidence.voiceCalls.length) {
    console.log("\nVoice calls:");
    for (const c of evidence.voiceCalls) {
      console.log(
        `  ${c.startedAt.toISOString()} ${c.status} ${c.fromE164} → ${c.toE164} telnyx=${c.telnyxCallControlId || "—"}`,
      );
      for (const ev of c.events.filter((e) => /dtmf|gather|digit|consent/i.test(e.eventType))) {
        console.log(`    event ${ev.eventType} ${ev.providerEventId || ""}`);
      }
    }
  }

  if (evidence.consentEvents.length) {
    console.log("\nConsent records:");
    for (const c of evidence.consentEvents) {
      console.log(
        `  ${c.consentedAt.toISOString()} caller=${maskPhone(c.callerNumber)} input=${c.affirmativeInput} asset=${c.promptAssetId || "—"} v=${c.promptVersion || "—"}`,
      );
    }
  }

  if (evidence.outboundMessages.length) {
    console.log("\nOutbound SMS:");
    for (const m of evidence.outboundMessages) {
      console.log(
        `  ${m.createdAt.toISOString()} ${m.status} ${m.from} → ${maskPhone(m.to)} id=${m.providerId || "—"}`,
      );
    }
  }

  if (evidence.inboundConversationMessages.length) {
    console.log("\nInbound replies:");
    for (const m of evidence.inboundConversationMessages) {
      console.log(
        `  ${m.createdAt.toISOString()} conv=${m.conversationId} provider=${m.providerMessageId || "—"} body=${m.body.slice(0, 60)}`,
      );
    }
  }

  if (evidence.suppressions.length) {
    console.log("\nSuppressions:");
    for (const s of evidence.suppressions) {
      console.log(`  ${s.createdAt.toISOString()} ${s.phone} reason=${s.reason || "—"}`);
    }
  }

  if (evidence.duplicateProviderIds.length) {
    console.log("\n⚠️ Duplicate provider message IDs:");
    for (const d of evidence.duplicateProviderIds) {
      console.log(`  ${d.providerMessageId} x${d.count}`);
    }
  }
}
