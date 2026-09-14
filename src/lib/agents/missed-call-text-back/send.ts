import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { evaluateMissedCallTextEligibility } from "./eligibility";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTrace } from "./trace";
import { getDemoMessageBody } from "@/lib/mctb/onboarding/demo";
import {
  reserveTrialSmsSegments,
  releaseTrialSmsSegmentReservation,
} from "@/lib/mctb/entitlement";

import { resolveMctbMessageTemplate, renderMctbMessageTemplate } from "@/lib/mctb/message-template";
import {
  resolveMctbLinkDestinationUrl,
  resolveMctbTemplateVars,
} from "@/lib/mctb/template-vars";
import { wrapMctbMessageUrlsWithTracking } from "@/lib/mctb/link-tracking";
import { traceMctbPipeline, traceMctbPipelineSkip } from "@/lib/mctb/pipeline-trace";

function renderTemplate(template: string, vars: Record<string, string>): string {
  return renderMctbMessageTemplate(template, vars);
}

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
    await appendMctbTrace({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "mctb.eligibility.failed",
      detail: { reason: eligibility.reason },
    });
    return { ok: false, reason: eligibility.reason };
  }

  const contact = event.contactId
    ? await prisma.contact.findUnique({ where: { id: event.contactId } })
    : await prisma.contact.findFirst({
        where: { workspaceId: input.workspaceId, phone: event.callerE164 },
      });

  const templateVars = resolveMctbTemplateVars({
    config,
    callerE164: event.callerE164,
    contact,
    missedCallEventId: event.id,
  });

  const rawBody = demoMode
    ? getDemoMessageBody()
    : renderTemplate(resolveMctbMessageTemplate(config), templateVars);

  const destinationUrl = demoMode
    ? null
    : resolveMctbLinkDestinationUrl(config);

  const tracked = demoMode
    ? { body: rawBody, trackingToken: null as string | null, destinationUrl: null as string | null }
    : wrapMctbMessageUrlsWithTracking({
        body: rawBody,
        destinationUrl,
      });

  const body = tracked.body;

  await prisma.missedCallEvent.update({
    where: { id: event.id },
    data: { status: "SENDING" },
  });

  let trialReservation: { reserved: boolean; segments: number } | null = null;
  if (!demoMode) {
    const reservation = await reserveTrialSmsSegments(input.workspaceId, 1);
    if (!reservation.reserved) {
      await prisma.missedCallEvent.update({
        where: { id: event.id },
        data: {
          status: "SUPPRESSED",
          suppressionReason: "TRIAL_SMS_LIMIT",
          eligible: false,
        },
      });
      return { ok: false, reason: "TRIAL_SMS_LIMIT" };
    }
    trialReservation = { reserved: true, segments: 1 };
  }

  const { resolveMctbOutboundSmsRoute } = await import("@/lib/mctb/messaging/outbound-sms-route");
  const route = await resolveMctbOutboundSmsRoute({
    workspaceId: input.workspaceId,
    config,
    demoMode,
  });

  if (!route?.fromE164) {
    const routeReason = demoMode ? "NOT_SMS_CAPABLE" : "MESSAGING_NOT_APPROVED";
    traceMctbPipelineSkip("send", "outbound_route", routeReason, {
      ...input,
      demoMode,
    });
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
    await appendMctbTrace({
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

  await appendMctbTrace({
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
      customerName: contact?.firstName || undefined,
      idempotencyKey: `mctb-recovery:${event.id}`,
      destinationUrl: tracked.destinationUrl || undefined,
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

    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SENT",
        eligible: true,
        smsSentAt: new Date(),
        smsMessageId: messageId,
      },
    });

    await appendMctbTrace({
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
      await ensureMctbRecoveryConversation({
        workspaceId: input.workspaceId,
        toE164: event.callerE164,
        fromE164: resolvedSender.e164,
        body: msgRow?.body || body,
        providerMessageId: msgRow?.providerId,
        missedCallEventId: event.id,
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
    await appendMctbTrace({
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      missedCallEventId: event.id,
      kind: "sms.send.failed",
      detail: { error: msg },
    });
    return { ok: false, reason: "PROVIDER_ERROR", error: msg };
  }
}
