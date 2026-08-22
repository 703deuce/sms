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

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), val);
    out = out.replace(new RegExp(`\\{\\{\\s*customer\\.${key}\\s*\\}\\}`, "gi"), val);
  }
  return out.trim();
}

/** Worker entry — recheck eligibility before send (owner may have disabled John). */
export async function executeMissedCallTextSend(input: {
  workspaceId: string;
  missedCallEventId: string;
  traceId: string;
}) {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
  });
  if (!event) return { ok: false, reason: "event_not_found" };
  if (event.smsSentAt || event.status === "SENT") {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const eventMeta =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  const demoMode = eventMeta.demoMode === true;
  const isEventOnlyCapture =
    eventMeta.captureMode === "EVENT_ONLY" || eventMeta.captureMode === "SIP_INGRESS";
  const isEventOnly = isEventOnlyCapture;

  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.enabled && !demoMode) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "SUPPRESSED", suppressionReason: "FEATURE_DISABLED" },
    });
    return { ok: false, reason: "FEATURE_DISABLED" };
  }

  if (isEventOnly) {
    const { validateExistingConsentAttestation } = await import(
      "@/lib/mctb/event-only/attestation"
    );
    const attestation = await validateExistingConsentAttestation(input.workspaceId);
    if (!attestation.valid) {
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

  const eligibility = await evaluateMissedCallTextEligibility({
    workspaceId: input.workspaceId,
    callerE164: event.callerE164,
    businessE164: event.businessE164,
    phoneNumberId: event.phoneNumberId,
    idempotencyKey: event.idempotencyKey,
    demoMode,
    eventOnly: isEventOnly,
    call: {
      direction: "inbound",
      disposition: event.disposition,
      status: event.reason,
    },
  });
  if (!eligibility.eligible) {
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

  const body = demoMode
    ? getDemoMessageBody()
    : renderTemplate(config.messageTemplate, {
        firstName: contact?.firstName || "there",
        name: [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "there",
        phone: event.callerE164,
      });

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
      demoBypass: demoMode,
      senderRoute: { sendWorkspaceId: route.sendWorkspaceId, fromE164: route.fromE164 },
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
        source: "mctb-event-only",
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

    return { ok: true, messageId, status: "queued" };
  } catch (err) {
    if (trialReservation?.reserved) {
      await releaseTrialSmsSegmentReservation(input.workspaceId, trialReservation.segments).catch(
        () => undefined,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
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
