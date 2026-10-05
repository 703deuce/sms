import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { evaluateMissedCallTextEligibility } from "./eligibility";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTraceOnce } from "./trace";
import { getDemoMessageBody } from "@/lib/mctb/onboarding/demo";
import {
  reserveTrialSmsSegments,
  releaseTrialSmsSegmentReservation,
} from "@/lib/mctb/entitlement";

import { resolveMctbRecoveryOpenerForSend } from "@/lib/mctb/first-text-templates/send-resolve";
import { resolveMctbFirstTextBusinessName } from "@/lib/mctb/first-text-templates/business-name";
import { resolveMctbTemplateVars } from "@/lib/mctb/template-vars";
import { traceMctbPipeline, traceMctbPipelineSkip } from "@/lib/mctb/pipeline-trace";
import { mctbCallerE164Variants } from "@/lib/mctb/messaging/caller-e164";
import { stripMctbTrackingUrlsFromSms } from "@/lib/mctb/sms-channel";
import { claimMctbRecoverySmsSend } from "./send-claim";

/** Worker entry — recheck eligibility before send (owner may have disabled John). */
export async function executeMissedCallTextSend(input: {
  workspaceId: string;
  missedCallEventId: string;
  traceId: string;
}) {
  traceMctbPipeline({
    layer: "send",
    step: "start",
    outcome: "ok",
    traceId: input.traceId,
    workspaceId: input.workspaceId,
    missedCallEventId: input.missedCallEventId,
  });

  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
  });
  if (!event) {
    traceMctbPipelineSkip("send", "load_event", "event_not_found", input);
    return { ok: false, reason: "event_not_found" };
  }

  const openerMaxAgeMs = Number(process.env.MCTB_OPENER_MAX_AGE_MS || 72 * 60 * 60 * 1000);
  const eventAgeMs = Date.now() - event.createdAt.getTime();
  if (
    !event.smsSentAt &&
    eventAgeMs > openerMaxAgeMs &&
    (event.status === "SCHEDULED" || event.status === "SENDING" || event.status === "DETECTED")
  ) {
    traceMctbPipelineSkip("send", "stale_opener", "stale_opener_expired", {
      ...input,
      eventAgeMs,
      openerMaxAgeMs,
    });
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        suppressionReason: "STALE_OPENER_EXPIRED",
        eligible: false,
      },
    });
    return { ok: true, skipped: true, reason: "stale_opener_expired" };
  }

  if (event.smsSentAt || event.status === "SENT") {
    traceMctbPipelineSkip("send", "load_event", "already_sent", {
      ...input,
      status: event.status,
    });
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const eventMeta =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  const demoMode = eventMeta.demoMode === true;

  const { reconcileTelnyxSendStateIfNeeded } = await import("@/lib/messaging/reconcile-send-state");
  await reconcileTelnyxSendStateIfNeeded(input.workspaceId);
  const captureMode = String(eventMeta.captureMode || "");
  const isEventOnlyCapture = captureMode === "EVENT_ONLY" || captureMode === "SIP_INGRESS";
  const isEventOnly = isEventOnlyCapture;
  // EVENT_ONLY = carrier-forward Existing Consent. SIP_INGRESS = Press-1 IVR consent per call.
  const requiresExistingConsentAttestation = captureMode === "EVENT_ONLY";

  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.enabled && !demoMode) {
    traceMctbPipelineSkip("send", "feature_gate", "feature_disabled", input);
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "SUPPRESSED", suppressionReason: "FEATURE_DISABLED" },
    });
    return { ok: false, reason: "FEATURE_DISABLED" };
  }

  if (requiresExistingConsentAttestation) {
    const { validateExistingConsentAttestation } = await import(
      "@/lib/mctb/capture/attestation"
    );
    const attestation = await validateExistingConsentAttestation(input.workspaceId);
    if (!attestation.valid) {
      traceMctbPipelineSkip("send", "attestation", attestation.reason || "missing_attestation", input);
      await prisma.missedCallEvent.update({
        where: { id: event.id },
        data: {
          status: "SUPPRESSED",
          suppressionReason: attestation.reason || "MISSING_ATTESTATION",
          eligible: false,
        },
      });
      return { ok: false, reason: attestation.reason || "MISSING_ATTESTATION" };
    }
  }

  const forwardedFromE164 =
    typeof eventMeta.forwardedFromE164 === "string"
      ? eventMeta.forwardedFromE164
      : typeof eventMeta.forwardedFrom === "string"
        ? eventMeta.forwardedFrom
        : null;
  const transovoNumberE164 =
    typeof eventMeta.transovoNumberE164 === "string"
      ? eventMeta.transovoNumberE164
      : event.businessE164;

  const eligibility = await evaluateMissedCallTextEligibility({
    workspaceId: input.workspaceId,
    callerE164: event.callerE164,
    businessE164: event.businessE164,
    phoneNumberId: event.phoneNumberId,
    idempotencyKey: event.idempotencyKey,
    demoMode,
    eventOnly: isEventOnly,
    forwardedFromE164,
    transovoNumberE164,
    eventMetadata: eventMeta,
    call: {
      direction: "inbound",
      disposition: event.disposition,
      status: event.reason,
    },
  });
  if (!eligibility.eligible) {
    traceMctbPipelineSkip("send", "eligibility", eligibility.reason || "ineligible", {
      ...input,
      caller: event.callerE164,
      business: event.businessE164,
    });
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        suppressionReason: eligibility.reason,
        eligible: false,
      },
    });
    await appendMctbTraceOnce({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "mctb.eligibility.failed",
      detail: { reason: eligibility.reason },
    });
    return { ok: false, reason: eligibility.reason };
  }

  const sendClaim = await claimMctbRecoverySmsSend({
    workspaceId: input.workspaceId,
    missedCallEventId: event.id,
  });
  if (!sendClaim.claimed) {
    traceMctbPipelineSkip("send", "send_claim", sendClaim.reason, input);
    if (sendClaim.reason === "already_sent") {
      return { ok: true, skipped: true, reason: "already_sent" };
    }
    if (sendClaim.reason === "in_progress") {
      return { ok: true, skipped: true, reason: "send_in_progress" };
    }
    return { ok: false, reason: sendClaim.reason };
  }

  const callerVariants = event.callerE164
    ? mctbCallerE164Variants(event.callerE164)
    : [];
  const contact = event.contactId
    ? await prisma.contact.findUnique({ where: { id: event.contactId } })
    : callerVariants.length > 0
      ? await prisma.contact.findFirst({
          where: { workspaceId: input.workspaceId, phone: { in: callerVariants } },
        })
      : null;

  const businessName = await resolveMctbFirstTextBusinessName(input.workspaceId);
  const templateVars = resolveMctbTemplateVars({
    config,
    callerE164: event.callerE164,
    contact,
    missedCallEventId: event.id,
    businessName,
  });

  const openerResolved = demoMode
    ? { body: getDemoMessageBody(), meta: null }
    : await resolveMctbRecoveryOpenerForSend({
        workspaceId: input.workspaceId,
        config,
        templateVars,
      });
  const rawBody = openerResolved.body;

  let body = stripMctbTrackingUrlsFromSms(rawBody);

  let trialReservation: { reserved: boolean; segments: number } | null = null;
  let recoveryUsageReserved = false;
  if (!demoMode) {
    const { reserveMctbRecoveryUnit } = await import("@/lib/mctb/recovery-usage");
    const excludeUsage =
      eventMeta.liveTest === true ||
      eventMeta.setupTest === true ||
      eventMeta.excludeFromRecoveryUsage === true ||
      eventMeta.testSms === true ||
      eventMeta.setupSms === true ||
      eventMeta.setupTest === true ||
      eventMeta.certMode != null;

    const recoveryReservation = await reserveMctbRecoveryUnit({
      workspaceId: input.workspaceId,
      missedCallEventId: event.id,
      excludeFromUsage: Boolean(excludeUsage),
      eventMetadata: eventMeta,
    });
    if (!recoveryReservation.reserved) {
      await prisma.missedCallEvent.update({
        where: { id: event.id },
        data: {
          status: "SUPPRESSED",
          suppressionReason: "MCTB_RECOVERY_LIMIT",
          eligible: false,
        },
      });
      return { ok: false, reason: "MCTB_RECOVERY_LIMIT" };
    }
    recoveryUsageReserved =
      !excludeUsage && recoveryReservation.reason !== "idempotent_replay";
  }

  const { resolveMctbOutboundSmsRoute } = await import("@/lib/mctb/messaging/outbound-sms-route");
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId: input.workspaceId,
    config,
    demoMode,
    recipientE164: event.callerE164,
  });

  if (!route?.fromE164) {
    const routeReason = demoMode ? "NOT_SMS_CAPABLE" : "MESSAGING_NOT_APPROVED";
    traceMctbPipelineSkip("send", "outbound_route", routeReason, {
      ...input,
      demoMode,
    });
    if (recoveryUsageReserved) {
      const { releaseMctbRecoveryReservation } = await import("@/lib/mctb/recovery-usage");
      await releaseMctbRecoveryReservation(input.workspaceId, event.id).catch(() => undefined);
    }
    if (trialReservation?.reserved) {
      await releaseTrialSmsSegmentReservation(input.workspaceId, trialReservation.segments).catch(
        () => undefined,
      );
    }
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        suppressionReason: demoMode ? "NOT_SMS_CAPABLE" : "MESSAGING_NOT_APPROVED",
        eligible: false,
      },
    });
    await appendMctbTraceOnce({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "sms.send.blocked",
      detail: {
        reason: demoMode ? "NOT_SMS_CAPABLE" : "MESSAGING_NOT_APPROVED",
        demoMode,
      },
    });
    return { ok: false, reason: demoMode ? "NOT_SMS_CAPABLE" : "MESSAGING_NOT_APPROVED" };
  }

  const resolvedSender = {
    e164: route.fromE164,
    phoneNumberId: route.phoneNumberId,
    source: route.source,
  };

  const { gateMctbPlatformOutboundSend, touchMctbPlatformAssignmentAfterOutbound } =
    await import("@/lib/mctb/messaging/platform-outbound-gate");
  const platformGate = await gateMctbPlatformOutboundSend({
    workspaceId: input.workspaceId,
    route,
    consumerE164: event.callerE164,
    missedCallEventId: event.id,
  });
  if (!platformGate.ok) {
    if (recoveryUsageReserved) {
      const { releaseMctbRecoveryReservation } = await import("@/lib/mctb/recovery-usage");
      await releaseMctbRecoveryReservation(input.workspaceId, event.id).catch(() => undefined);
    }
    if (trialReservation?.reserved) {
      await releaseTrialSmsSegmentReservation(input.workspaceId, trialReservation.segments).catch(
        () => undefined,
      );
    }
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        suppressionReason: "PLATFORM_SENDER_PAIR_COLLISION",
        eligible: false,
      },
    });
    await appendMctbTraceOnce({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "sms.send.blocked",
      detail: {
        reason: "PLATFORM_SENDER_PAIR_COLLISION",
        ownerWorkspaceId: platformGate.ownerWorkspaceId,
      },
    });
    return { ok: false, reason: "PLATFORM_SENDER_PAIR_COLLISION" };
  }

  const { finalizeMctbPlatformConsumerSmsBody } = await import(
    "@/lib/mctb/messaging/platform-sender-consumer-disclosure"
  );
  body = await finalizeMctbPlatformConsumerSmsBody({
    workspaceId: input.workspaceId,
    consumerE164: event.callerE164,
    body,
    route,
    treatAsFirstMessage: true,
  });

  await appendMctbTraceOnce({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: event.id,
    kind: "sms.send.started",
    detail: {
      to: event.callerE164,
      from: resolvedSender.e164,
      senderSource: resolvedSender.source,
      complianceRegime: route.complianceRegime,
      trafficMode: route.trafficMode,
      sendWorkspaceId: route.sendWorkspaceId,
    },
  });

  try {
    const result = await sendQuickSms({
      workspaceId: input.workspaceId,
      to: event.callerE164,
      body,
      from: resolvedSender.e164,
      idempotencyKey: `mctb-recovery:${event.id}`,
      omitConsumerTrackingLink: true,
      demoBypass: demoMode,
      senderRoute: {
        sendWorkspaceId: route.sendWorkspaceId,
        fromE164: route.fromE164,
        phoneNumberId: route.phoneNumberId,
      },
    });

    const messageId =
      result && typeof result === "object" && "messageId" in result
        ? String((result as { messageId?: string }).messageId || "")
        : null;

    const priorMeta =
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : {};
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SENT",
        eligible: true,
        smsSentAt: new Date(),
        smsMessageId: messageId,
        metadata: {
          ...priorMeta,
          outboundSmsPhoneNumberId: route.phoneNumberId,
          outboundSmsFromE164: route.fromE164,
          outboundSmsSenderMode: route.senderMode,
          ...(openerResolved.meta
            ? {
                firstTextTemplateId: openerResolved.meta.firstTextTemplateId,
                firstTextTemplateVersion: openerResolved.meta.firstTextTemplateVersion,
                firstTextSentAt: new Date().toISOString(),
                recoveryBusinessName: openerResolved.meta.recoveryBusinessName,
                recoveryCallbackTimePhrase: openerResolved.meta.recoveryCallbackTimePhrase,
                recoveryInBusinessHours: openerResolved.meta.recoveryInBusinessHours,
              }
            : {}),
        },
      },
    });

    await appendMctbTraceOnce({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "sms.send.accepted",
      detail: { messageId, providerStatus: "queued", demoMode },
    });

    console.log(
      JSON.stringify({
        source: "mctb-capture",
        event: "mctb_sms_sent",
        timestamp: new Date().toISOString(),
        workspaceId: input.workspaceId,
        missedCallEventId: event.id,
        callerE164: event.callerE164,
        fromE164: resolvedSender.e164,
        messageId,
        captureMode: eventMeta.captureMode || null,
      }),
    );

    if (demoMode) {
      const { recordDemoTextSent } = await import("@/lib/mctb/onboarding/demo");
      await recordDemoTextSent(input.workspaceId).catch(() => undefined);
    }

    if (messageId) {
      const msgRow = await prisma.message.findUnique({
        where: { id: messageId },
        select: { providerId: true, body: true },
      });
      const { ensureMctbRecoveryConversation } = await import(
        "@/lib/mctb/messaging/recovery-conversation"
      );
      const conv = await ensureMctbRecoveryConversation({
        workspaceId: input.workspaceId,
        toE164: event.callerE164,
        fromE164: resolvedSender.e164,
        body: msgRow?.body || body,
        providerMessageId: msgRow?.providerId,
        missedCallEventId: event.id,
        outboundSmsPhoneNumberId: route.phoneNumberId,
      }).catch(() => ({ conversationId: null }));
      await touchMctbPlatformAssignmentAfterOutbound({
        workspaceId: input.workspaceId,
        route,
        consumerE164: event.callerE164,
        conversationId: conv?.conversationId,
        claim: platformGate.claim,
      }).catch(() => undefined);
    }

    traceMctbPipeline({
      layer: "send",
      step: "sms_sent",
      outcome: "sent",
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      missedCallEventId: event.id,
      messageId,
      from: resolvedSender.e164,
      to: event.callerE164,
      demoMode,
    });

    return { ok: true, messageId, status: "queued" };
  } catch (err) {
    if (recoveryUsageReserved) {
      const { releaseMctbRecoveryReservation } = await import("@/lib/mctb/recovery-usage");
      await releaseMctbRecoveryReservation(input.workspaceId, event.id).catch(() => undefined);
    }
    if (trialReservation?.reserved) {
      await releaseTrialSmsSegmentReservation(input.workspaceId, trialReservation.segments).catch(
        () => undefined,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    traceMctbPipeline({
      layer: "send",
      step: "sms_failed",
      outcome: "fail",
      reason: msg,
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      missedCallEventId: event.id,
    });
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", suppressionReason: "PROVIDER_ERROR" },
    });
    await appendMctbTraceOnce({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "sms.send.failed",
      detail: { error: msg },
    });
    return { ok: false, reason: "PROVIDER_ERROR", error: msg };
  }
}
