import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/server/db";
import { createId } from "@/lib/supabase/id";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import type { HumanCall } from "@prisma/client";
import { classifyInboundCallOutcome } from "@/lib/server/mctb/classify";
import { evaluatePhoneMctbEligibility } from "@/lib/server/mctb/eligibility";
import { loadMctbRecoveryConfig } from "@/lib/server/mctb/config";
import { executeMctbRecoverySend } from "@/lib/server/mctb/send-recovery";

function humanCallToClassifier(call: HumanCall) {
  const disposition = call.disposition || "";
  const voicemailDetected = call.status === "voicemail" || disposition.includes("voicemail");
  return {
    direction: call.direction,
    status: call.status === "missed" ? "NO_ANSWER" : call.status,
    disposition,
    answeredAt: call.answeredAt,
    voicemailDetected,
    hangupCause: disposition.includes(":") ? disposition.split(":").pop() : null,
  };
}

function buildIdempotencyKey(workspaceId: string, humanCallId: string) {
  return `phone-mctb:${workspaceId}:${humanCallId}`;
}

export function schedulePhoneOwnedMctbIfMissed(input: { workspaceId: string; humanCallId: string }) {
  void processPhoneOwnedMctbMissedCall(input).catch((err) => {
    console.error("[phone-mctb] missed-call pipeline failed", err);
  });
}

/**
 * Phone-owned-number MCTB entry — call after terminal missed inbound humanCall.
 */
export async function processPhoneOwnedMctbMissedCall(input: {
  workspaceId: string;
  humanCallId: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.direction !== "inbound") {
    return { ok: false, reason: "not_inbound" };
  }
  if (call.answeredAt) {
    return { ok: false, reason: "answered" };
  }

  const phoneRow = call.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: call.phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, e164: true, settingsJson: true },
      })
    : null;

  if (!phoneRow?.e164) {
    return { ok: false, reason: "no_business_number" };
  }

  const callerE164 = call.from;
  const businessE164 = phoneRow.e164;
  const idempotencyKey = buildIdempotencyKey(input.workspaceId, call.id);
  const classifier = humanCallToClassifier(call);
  const classification = classifyInboundCallOutcome(classifier);

  const eligibility = await evaluatePhoneMctbEligibility({
    workspaceId: input.workspaceId,
    phoneNumberId: phoneRow.id,
    phoneSettingsJson: phoneRow.settingsJson,
    callerE164,
    call: classifier,
    idempotencyKey,
  });

  const traceId = `mctb_${createId()}`;
  let caller = callerE164;
  try {
    caller = normalizeE164(callerE164);
  } catch {
    return { ok: false, reason: "invalid_caller" };
  }

  const existing = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return {
      ok: true,
      deduped: true,
      missedCallEventId: existing.id,
      status: existing.status,
    };
  }

  let event;
  try {
    event = await prisma.missedCallEvent.create({
      data: {
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        contactId: call.contactId,
        callerE164: caller,
        businessE164,
        phoneNumberId: phoneRow.id,
        reason: classification,
        disposition: call.disposition,
        status: eligibility.eligible ? "ELIGIBILITY_CHECK" : "SUPPRESSED",
        eligible: eligibility.eligible,
        suppressionReason: eligibility.reason,
        traceId,
        idempotencyKey,
        metadata: {
          captureMode: "PHONE_OWNED",
          source: "new_app_phone",
        },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey } });
      if (raced) return { ok: true, deduped: true, missedCallEventId: raced.id };
    }
    throw err;
  }

  if (!eligibility.eligible) {
    return {
      ok: true,
      missedCallEventId: event.id,
      eligible: false,
      reason: eligibility.reason,
    };
  }

  const config = await loadMctbRecoveryConfig(input.workspaceId);
  const delayMs = Math.max(0, config.delaySeconds * 1000);
  const runAt = new Date(Date.now() + delayMs);

  await prisma.missedCallEvent.update({
    where: { id: event.id },
    data: { scheduledSmsAt: runAt, status: "SCHEDULED" },
  });

  const runSend = async () => {
    await executeMctbRecoverySend({
      workspaceId: input.workspaceId,
      missedCallEventId: event.id,
    });
  };

  void (async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await runSend();
  })();

  return {
    ok: true,
    missedCallEventId: event.id,
    eligible: true,
    scheduledAt: runAt.toISOString(),
  };
}
