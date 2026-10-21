import "server-only";

import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import {
  classificationTriggersMctb,
  classifyInboundCallOutcome,
  type ClassifyInboundCallInput,
} from "@/lib/server/mctb/classify";
import { loadMctbRecoveryConfig } from "@/lib/server/mctb/config";
import { readPhoneMctbInbound } from "@/lib/server/mctb/phone-line-config";
import { isExistingConsentMode, MCTB_CONSENT_MODE_VERIFIED } from "@/lib/mctb/consent-mode";
import { loadMctbConsentMode, validateExistingConsentAttestation } from "@/lib/server/mctb/attestation";
import { readMctbPress1FromCallMetadata } from "@/lib/server/mctb/press1-consent";

export type MctbSuppressionReason =
  | "INVALID_PHONE"
  | "FEATURE_DISABLED"
  | "LINE_DISABLED"
  | "NOT_MISSED"
  | "CALL_ANSWERED"
  | "TRIGGER_DISABLED"
  | "COOLDOWN_ACTIVE"
  | "BLOCKED_NUMBER"
  | "OPTED_OUT"
  | "NOT_EXISTING_CONSENT"
  | "PRESS_1_REQUIRED"
  | "RECOVERY_PAUSED"
  | "ALREADY_SENT";

function callerVariants(e164: string): string[] {
  const normalized = normalizeE164(e164);
  return [normalized, e164].filter(Boolean);
}

export async function evaluatePhoneMctbEligibility(input: {
  workspaceId: string;
  phoneNumberId: string | null;
  phoneSettingsJson: unknown;
  callerE164: string;
  call: ClassifyInboundCallInput;
  idempotencyKey: string;
  humanCallId?: string;
}): Promise<{ eligible: boolean; reason: MctbSuppressionReason | null; classification: string }> {
  const line = readPhoneMctbInbound(input.phoneSettingsJson);
  const config = await loadMctbRecoveryConfig(input.workspaceId);
  const classification = classifyInboundCallOutcome(input.call);

  let caller = "";
  try {
    caller = normalizeE164(input.callerE164);
  } catch {
    return { eligible: false, reason: "INVALID_PHONE", classification };
  }

  if (!line.enabled) {
    return { eligible: false, reason: "LINE_DISABLED", classification };
  }
  if (!config.enabled) {
    return { eligible: false, reason: "RECOVERY_PAUSED", classification };
  }

  const consentMode = await loadMctbConsentMode(input.workspaceId);
  if (isExistingConsentMode(consentMode)) {
    const attested = await validateExistingConsentAttestation(input.workspaceId);
    if (!attested) {
      return { eligible: false, reason: "NOT_EXISTING_CONSENT", classification };
    }
  } else if (consentMode === MCTB_CONSENT_MODE_VERIFIED) {
    if (input.humanCallId) {
      const humanCall = await getPrisma().humanCall.findFirst({
        where: { id: input.humanCallId, workspaceId: input.workspaceId },
        select: { metadata: true },
      });
      if (readMctbPress1FromCallMetadata(humanCall?.metadata) === "pressed") {
        // Caller pressed 1 on the owned Call Control leg — allow recovery SMS.
      } else {
        return { eligible: false, reason: "PRESS_1_REQUIRED", classification };
      }
    } else {
      return { eligible: false, reason: "PRESS_1_REQUIRED", classification };
    }
  }

  if (classification === "answered" || classification === "outbound") {
    return {
      eligible: false,
      reason: classification === "outbound" ? "NOT_MISSED" : "CALL_ANSWERED",
      classification,
    };
  }

  if (
    classification === "unknown" ||
    !classificationTriggersMctb(classification, {
      sendAfterNoAnswer: config.sendAfterNoAnswer,
      sendAfterBusy: config.sendAfterBusy,
      sendAfterRejected: config.sendAfterRejected,
      sendAfterTimeout: config.sendAfterTimeout,
      sendAfterVoicemail: config.sendAfterVoicemail,
    })
  ) {
    return { eligible: false, reason: "TRIGGER_DISABLED", classification };
  }

  const prisma = getPrisma();
  const existing = await prisma.missedCallEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing?.smsSentAt || existing?.status === "SENT") {
    return { eligible: false, reason: "ALREADY_SENT", classification };
  }

  const blockedVariants = callerVariants(caller);
  const blocked = await prisma.suppression.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [
        { phone: { in: blockedVariants } },
        ...blockedVariants.map((v) => ({ suppressionKey: `${input.workspaceId}:p:${v}` })),
      ],
    },
  });
  if (blocked) {
    return { eligible: false, reason: "BLOCKED_NUMBER", classification };
  }

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: input.workspaceId, phone: { in: blockedVariants } },
    select: { status: true },
  });
  if (contact && contact.status !== "SUBSCRIBED") {
    return { eligible: false, reason: "OPTED_OUT", classification };
  }

  if (config.cooldownMinutes > 0) {
    const cooldownSince = new Date(Date.now() - config.cooldownMinutes * 60_000);
    const recentSent = await prisma.missedCallEvent.count({
      where: {
        workspaceId: input.workspaceId,
        callerE164: { in: blockedVariants },
        phoneNumberId: input.phoneNumberId || undefined,
        smsSentAt: { gte: cooldownSince },
      },
    });
    if (recentSent > 0) {
      return { eligible: false, reason: "COOLDOWN_ACTIVE", classification };
    }
  }

  return { eligible: true, reason: null, classification };
}
