/**
 * Pass 3 evidence collector — pulls provider IDs, consent, delivery, STOP/START, dedupe.
 */
import { getPrisma } from "@/lib/db";
import { getDemoStatus } from "@/lib/mctb/onboarding/demo";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { resolvePlatformDemoOwnerWorkspaceId } from "@/lib/mctb/onboarding/platform-demo";
import {
  EXISTING_CONSENT_METHOD,
  type MctbConsentMode,
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
} from "@/lib/mctb/consent-mode";

export type Pass3ConsentPhase = MctbConsentMode;

export type Pass3Evidence = {
  collectedAt: string;
  workspaceId: string;
  platformE164: string;
  consentPhase: Pass3ConsentPhase;
  consentProductCode: string;
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
    method: string;
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
  deliveryWebhooks: Array<{ eventType: string; providerEventId: string; createdAt: Date }>;
  smartRoutingCallSessions: Array<{
    id: string;
    finalOutcome: string | null;
    callerNumber: string;
    calledNumber: string;
    startedAt: Date;
    smsTriggered: boolean;
  }>;
  checklist: Record<string, boolean>;
  /** Hard gates — all must pass before LIVE_VERIFIED (provider IDs + callbacks required). */
  strict: Pass3StrictEvaluation;
  messagingBehavior: Record<string, boolean>;
};

export type Pass3StrictEvaluation = {
  liveVerified: boolean;
  blockingReasons: string[];
  strictChecklist: Record<string, boolean>;
  providerEvidence: {
    callControlIds: string[];
    outboundProviderIds: string[];
    inboundProviderIds: string[];
    deliveryWebhookEventTypes: string[];
  };
};

const PLATFORM_DIGITS = MCTB_PLATFORM_DEMO_E164.replace(/\D/g, "");

/** Real Telnyx provider id — rejects placeholders and internal idempotency keys. */
export function isRealTelnyxProviderId(id: string | null | undefined): boolean {
  if (!id || id.trim().length < 8) return false;
  const lower = id.trim().toLowerCase();
  if (lower.startsWith("pending:") || lower.startsWith("idem:")) return false;
  if (/^test_|^mock_|^sim_/i.test(id)) return false;
  return true;
}

function isFrom571(from: string): boolean {
  return from.replace(/\D/g, "") === PLATFORM_DIGITS;
}

export function evaluatePass3StrictEvidence(evidence: Pass3Evidence): Pass3StrictEvaluation {
  const blockingReasons: string[] = [];

  const callControlIds = evidence.voiceCalls
    .map((c) => c.telnyxCallControlId)
    .filter((id): id is string => isRealTelnyxProviderId(id));

  const outboundFrom571 = evidence.outboundMessages.filter((m) => isFrom571(m.from));
  const outboundProviderIds = outboundFrom571
    .map((m) => m.providerId)
    .filter((id): id is string => isRealTelnyxProviderId(id));

  const inboundProviderIds = evidence.inboundConversationMessages
    .map((m) => m.providerMessageId)
    .filter((id): id is string => isRealTelnyxProviderId(id));

  const deliveryWebhookEventTypes = evidence.deliveryWebhooks.map((w) => w.eventType);

  const hasDeliveredOutbound = outboundFrom571.some((m) => m.status === "delivered");
  const hasDeliveryWebhook = deliveryWebhookEventTypes.some((t) =>
    /message\.delivered|delivered/i.test(t),
  );

  const missedCallSent = evidence.missedCallEvents.some(
    (e) => e.status === "SENT" && isFrom571(e.businessE164),
  );

  const existingAttestation = evidence.consentEvents.some(
    (c) => c.method === EXISTING_CONSENT_METHOD,
  );
  const press1Consent = evidence.consentEvents.some((c) => c.affirmativeInput === "1");
  const consentWithPrompt = evidence.consentEvents.some(
    (c) => c.promptAssetId && c.promptVersion,
  );
  const smartRoutingTriggered = evidence.smartRoutingCallSessions.some((s) => s.smsTriggered);

  const strictChecklist: Record<string, boolean> = {
    telnyx_call_control_id: callControlIds.length > 0,
    missed_call_sms_sent: missedCallSent,
    outbound_from_571: outboundFrom571.length > 0,
    telnyx_outbound_message_id: outboundProviderIds.length > 0,
    telnyx_delivery_callback: hasDeliveredOutbound || hasDeliveryWebhook,
    inbound_reply_provider_id: inboundProviderIds.length > 0,
    conversation_thread: evidence.inboundConversationMessages.length > 0,
  };

  if (evidence.consentPhase === MCTB_CONSENT_MODE_EXISTING) {
    Object.assign(strictChecklist, {
      existing_consent_attestation: existingAttestation,
      no_dtmf_press_1: !press1Consent,
      direct_path_no_press1_ivr: !smartRoutingTriggered,
    });
  } else {
    Object.assign(strictChecklist, {
      dtmf_press_1_consent: press1Consent,
      consent_prompt_asset_version: consentWithPrompt,
      smart_routing_sms_triggered: smartRoutingTriggered,
    });
  }

  for (const [key, ok] of Object.entries(strictChecklist)) {
    if (!ok) blockingReasons.push(`missing:${key}`);
  }

  return {
    liveVerified: blockingReasons.length === 0,
    blockingReasons,
    strictChecklist,
    providerEvidence: {
      callControlIds,
      outboundProviderIds,
      inboundProviderIds,
      deliveryWebhookEventTypes,
    },
  };
}

export function evaluatePass3MessagingBehavior(evidence: Pass3Evidence): Record<string, boolean> {
  const stopRecorded = evidence.suppressions.some((s) =>
    String(s.reason || "").toUpperCase().includes("STOP"),
  );

  const blockedAfterStop = evidence.missedCallEvents.some((e) => {
    if (e.status !== "SUPPRESSED") return false;
    const reason = String(e.suppressionReason || "").toUpperCase();
    return (
      reason.includes("OPTED_OUT") ||
      reason.includes("BLOCKED") ||
      reason.includes("SUPPRESSION")
    );
  });

  const stopAt = evidence.suppressions.find((s) =>
    String(s.reason || "").toUpperCase().includes("STOP"),
  )?.createdAt;

  const restoredAfterStart = stopAt
    ? evidence.outboundMessages.some(
        (m) =>
          isFrom571(m.from) &&
          m.status === "delivered" &&
          m.createdAt > stopAt &&
          isRealTelnyxProviderId(m.providerId),
      )
    : false;

  const cooldownBlocked = evidence.missedCallEvents.some(
    (e) => String(e.suppressionReason || "").toUpperCase() === "COOLDOWN_ACTIVE",
  );

  return {
    stop_suppression_recorded: stopRecorded,
    send_blocked_after_stop: blockedAfterStop,
    start_restore_send: restoredAfterStart,
    webhook_dedupe_clean: evidence.duplicateProviderIds.length === 0,
    cooldown_suppression: cooldownBlocked,
  };
}

function maskPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length < 7) return e164;
  return `***${d.slice(-4)}`;
}

export async function collectPass3Evidence(input: {
  workspaceId: string;
  sinceHours?: number;
  /** Which consent-mode certification phase this evidence belongs to. */
  consentPhase?: Pass3ConsentPhase;
}): Promise<Pass3Evidence> {
  const consentPhase = input.consentPhase ?? MCTB_CONSENT_MODE_EXISTING;
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

  const deliveryWebhooks = await prisma.providerWebhookEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider: "telnyx",
      createdAt: { gte: since },
      OR: [
        { eventType: { contains: "message.delivered" } },
        { eventType: { contains: "message.sent" } },
        { eventType: { contains: "message.received" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { eventType: true, providerEventId: true, createdAt: true },
  });

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
  const hasRealDelivery = outboundMessages.some(
    (m) => m.status === "delivered" && isRealTelnyxProviderId(m.providerId),
  );

  const sharedMessaging = {
    telnyx_call_id: voiceCalls.some((c) => isRealTelnyxProviderId(c.telnyxCallControlId)),
    outbound_sms_from_571: outboundMessages.some((m) => isFrom571(m.from)),
    telnyx_message_id: outboundMessages.some((m) => isRealTelnyxProviderId(m.providerId)),
    delivery_status: hasRealDelivery,
    inbound_reply_webhook: inboundConversationMessages.some((m) =>
      isRealTelnyxProviderId(m.providerMessageId),
    ),
    conversation_created: inboundConversationMessages.length > 0,
    missed_call_detected: missedCallEvents.some((e) => e.status === "SENT"),
    stop_suppression: suppressions.some((s) => String(s.reason || "").toUpperCase().includes("STOP")),
    demo_wizard_updated: Boolean(demo.checks.textDelivered && demo.checks.replyReceived),
    demo_events_only_for_segment_check:
      demoOnlyEvents.length === 0 || demoOnlyEvents.every((e) => e.status === "SENT" || e.status === "SUPPRESSED"),
    webhook_dedupe_clean: duplicateProviderIds.length === 0,
  };

  const existingConsentChecklist = {
    ...sharedMessaging,
    existing_consent_attestation: consentEvents.some((c) => c.method === EXISTING_CONSENT_METHOD),
    no_press_1_required: !consentEvents.some((c) => c.affirmativeInput === "1"),
  };

  const verifiedCallChecklist = {
    ...sharedMessaging,
    dtmf_press_1_consent: consentEvents.some((c) => c.affirmativeInput === "1"),
    consent_record_with_prompt: consentEvents.some((c) => c.promptAssetId && c.promptVersion),
    smart_routing_session: smartRoutingCallSessions.some((s) => s.smsTriggered),
  };

  const checklist =
    consentPhase === MCTB_CONSENT_MODE_VERIFIED
      ? verifiedCallChecklist
      : existingConsentChecklist;

  const consentProductCode =
    consentPhase === MCTB_CONSENT_MODE_VERIFIED ? "VERIFIED_CALL_CONSENT" : "EXISTING_CONSENT";

  const baseEvidence: Omit<Pass3Evidence, "strict" | "messagingBehavior"> = {
    collectedAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    platformE164: MCTB_PLATFORM_DEMO_E164,
    consentPhase,
    consentProductCode,
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
    deliveryWebhooks,
    smartRoutingCallSessions,
    checklist,
  };

  const strict = evaluatePass3StrictEvidence(baseEvidence as Pass3Evidence);
  const messagingBehavior = evaluatePass3MessagingBehavior(baseEvidence as Pass3Evidence);

  return {
    ...baseEvidence,
    strict,
    messagingBehavior,
  };
}

export function printPass3Evidence(evidence: Pass3Evidence) {
  console.log("\n── Pass 3 evidence ──\n");
  console.log(`Collected: ${evidence.collectedAt}`);
  console.log(`Workspace: ${evidence.workspaceId}`);
  console.log(`Platform:  ${evidence.platformE164}`);
  console.log(`Consent:   ${evidence.consentProductCode} (${evidence.consentPhase})\n`);

  console.log("Demo wizard:");
  console.log(`  call: ${evidence.demo.checks.callDetected}`);
  console.log(`  text: ${evidence.demo.checks.textDelivered}`);
  console.log(`  reply: ${evidence.demo.checks.replyReceived}`);
  console.log(
    `Trial segments used: ${evidence.trialSegments.used} / ${evidence.trialSegments.limit ?? "∞"}`,
  );
  console.log("(Demo traffic should not increment trial segments.)\n");

  console.log("Checklist (informational):");
  for (const [key, ok] of Object.entries(evidence.checklist)) {
    console.log(`  ${ok ? "✅" : "⬜"} ${key}`);
  }

  console.log(`\nStrict LIVE_VERIFIED gates: ${evidence.strict.liveVerified ? "✅ PASS" : "❌ FAIL"}`);
  for (const [key, ok] of Object.entries(evidence.strict.strictChecklist)) {
    console.log(`  ${ok ? "✅" : "⬜"} ${key}`);
  }
  if (evidence.strict.blockingReasons.length) {
    console.log("\nBlocking reasons:");
    for (const r of evidence.strict.blockingReasons) console.log(`  • ${r}`);
  }

  const pe = evidence.strict.providerEvidence;
  console.log("\nProvider evidence captured:");
  console.log(`  callControlIds:     ${pe.callControlIds.join(", ") || "—"}`);
  console.log(`  outboundProviderIds: ${pe.outboundProviderIds.join(", ") || "—"}`);
  console.log(`  inboundProviderIds:  ${pe.inboundProviderIds.join(", ") || "—"}`);
  console.log(
    `  deliveryWebhooks:    ${pe.deliveryWebhookEventTypes.join(", ") || "—"}`,
  );

  console.log("\nMessaging behavior (STOP/START/dedupe/cooldown):");
  for (const [key, ok] of Object.entries(evidence.messagingBehavior)) {
    console.log(`  ${ok ? "✅" : "⬜"} ${key}`);
  }

  if (evidence.voiceCalls.length) {
    console.log("\nVoice calls:");
    for (const c of evidence.voiceCalls) {
      console.log(
        `  ${c.startedAt.toISOString()} ${c.status} ${c.fromE164} → ${c.toE164} telnyx=${c.telnyxCallControlId || "—"}`,
      );
      for (const ev of (c.events || []).filter((e) => /dtmf|gather|digit|consent/i.test(e.eventType))) {
        console.log(`    event ${ev.eventType} ${ev.providerEventId || ""}`);
      }
    }
  }

  if (evidence.consentEvents.length) {
    console.log("\nConsent records:");
    for (const c of evidence.consentEvents) {
      console.log(
        `  ${c.consentedAt.toISOString()} method=${c.method} caller=${maskPhone(c.callerNumber)} input=${c.affirmativeInput} asset=${c.promptAssetId || "—"} v=${c.promptVersion || "—"}`,
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
