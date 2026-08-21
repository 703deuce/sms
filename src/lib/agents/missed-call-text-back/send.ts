import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { evaluateMissedCallTextEligibility } from "./eligibility";
import { loadMissedCallTextConfig } from "./config";
import { appendMctbTrace } from "./trace";
import { resolveMctbSmsSender } from "./sms-sender";
import { getDemoMessageBody } from "@/lib/mctb/onboarding/demo";

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

  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.enabled && !demoMode) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "SUPPRESSED", suppressionReason: "FEATURE_DISABLED" },
    });
    return { ok: false, reason: "FEATURE_DISABLED" };
  }

  const eligibility = await evaluateMissedCallTextEligibility({
    workspaceId: input.workspaceId,
    callerE164: event.callerE164,
    businessE164: event.businessE164,
    phoneNumberId: event.phoneNumberId,
    idempotencyKey: event.idempotencyKey,
    demoMode,
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

  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config,
  });
  let resolvedSender = sender;
  if (!resolvedSender?.e164 && demoMode) {
    const { resolvePlatformDemoSmsSender } = await import(
      "@/lib/agents/missed-call-text-back/demo-bypass"
    );
    resolvedSender = await resolvePlatformDemoSmsSender();
  }
  if (!resolvedSender?.e164) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", suppressionReason: "NOT_SMS_CAPABLE" },
    });
    return { ok: false, reason: "NOT_SMS_CAPABLE" };
  }

  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: event.id,
    kind: "sms.send.started",
    detail: { to: event.callerE164, from: resolvedSender.e164, senderSource: resolvedSender.source },
  });

  try {
    const result = await sendQuickSms({
      workspaceId: input.workspaceId,
      to: event.callerE164,
      body,
      from: resolvedSender.e164,
      customerName: contact?.firstName || undefined,
      idempotencyKey: `mctb:${event.idempotencyKey}`,
      demoBypass: demoMode,
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

    if (demoMode) {
      const { recordDemoTextSent } = await import("@/lib/mctb/onboarding/demo");
      await recordDemoTextSent(input.workspaceId).catch(() => undefined);
    }

    if (!demoMode) {
      const { recordTrialSmsSegmentUsage } = await import("@/lib/mctb/entitlement");
      await recordTrialSmsSegmentUsage(input.workspaceId, 1).catch(() => undefined);
    }

    return { ok: true, messageId, status: "queued" };
  } catch (err) {
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
