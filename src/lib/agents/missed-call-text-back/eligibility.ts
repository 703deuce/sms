import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  classificationTriggersMctb,
  type ClassifyInboundCallInput,
  classifyInboundCallOutcome,
} from "./classify";
import { loadMissedCallTextConfig } from "./config";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import type { InboundCallClassification, MctbSuppressionReason } from "./types";

export type EligibilityResult = {
  eligible: boolean;
  reason: MctbSuppressionReason | null;
  classification: InboundCallClassification;
};

function parseHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function inWindow(now: Date, tz: string, startHm: string | null, endHm: string | null): boolean {
  const start = parseHm(startHm);
  const end = parseHm(endHm);
  if (start == null || end == null) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const mins = hour * 60 + minute;
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export async function evaluateMissedCallTextEligibility(input: {
  workspaceId: string;
  callerE164: string;
  businessE164: string;
  phoneNumberId?: string | null;
  call: ClassifyInboundCallInput;
  idempotencyKey: string;
  demoMode?: boolean;
}): Promise<EligibilityResult> {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  const classification = classifyInboundCallOutcome(input.call);

  if (input.demoMode) {
    let caller = "";
    try {
      caller = normalizeE164(input.callerE164);
    } catch {
      return { eligible: false, reason: "INVALID_PHONE", classification };
    }
    if (!caller || caller.length < 8) {
      return { eligible: false, reason: "INVALID_PHONE", classification };
    }
    return { eligible: true, reason: null, classification };
  }

  if (!config.enabled) {
    return { eligible: false, reason: "FEATURE_DISABLED", classification };
  }

  const entitlement = await getMctbEntitlement(input.workspaceId);
  if (!entitlement.canSendAutomaticRecovery) {
    return {
      eligible: false,
      reason:
        entitlement.reason === "trial_sms_limit_reached"
          ? "TRIAL_SMS_LIMIT"
          : "ENTITLEMENT_SUSPENDED",
      classification,
    };
  }

  if (classification === "outbound" || classification === "answered") {
    return {
      eligible: false,
      reason: classification === "outbound" ? "OUTBOUND_CALL" : "CALL_ANSWERED",
      classification,
    };
  }

  if (
    classification === "unknown" ||
    !classificationTriggersMctb(classification, config)
  ) {
    return { eligible: false, reason: "NOT_MISSED", classification };
  }

  if (config.phoneNumberId && input.phoneNumberId && config.phoneNumberId !== input.phoneNumberId) {
    return { eligible: false, reason: "TRIGGER_DISABLED", classification };
  }

  let caller = "";
  try {
    caller = normalizeE164(input.callerE164);
  } catch {
    return { eligible: false, reason: "INVALID_PHONE", classification };
  }
  if (!caller || caller.length < 8) {
    return { eligible: false, reason: "INVALID_PHONE", classification };
  }

  const prisma = getPrisma();
  const existing = await prisma.missedCallEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing?.smsSentAt || existing?.status === "SENT") {
    return { eligible: false, reason: "ALREADY_SENT", classification };
  }

  if (config.suppressBlockedNumbers) {
    const blocked = await prisma.suppression.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [{ phone: caller }, { suppressionKey: `${input.workspaceId}:p:${caller}` }],
      },
    });
    if (blocked) {
      return { eligible: false, reason: "BLOCKED_NUMBER", classification };
    }
  }

  if (config.suppressOptedOutNumbers) {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: caller },
      select: { status: true },
    });
    if (contact && contact.status !== "SUBSCRIBED") {
      return { eligible: false, reason: "OPTED_OUT", classification };
    }
  }

  const cooldownSince = new Date(Date.now() - config.cooldownMinutes * 60_000);
  const recentSent = await prisma.missedCallEvent.count({
    where: {
      workspaceId: input.workspaceId,
      callerE164: caller,
      smsSentAt: { gte: cooldownSince },
    },
  });
  if (recentSent >= config.maxMessagesPerCaller) {
    return { eligible: false, reason: "COOLDOWN_ACTIVE", classification };
  }

  const now = new Date();
  if (config.quietHoursEnabled && config.quietHoursStart && config.quietHoursEnd) {
    if (!inWindow(now, config.timezone, config.quietHoursStart, config.quietHoursEnd)) {
      return { eligible: false, reason: "OUTSIDE_SEND_WINDOW", classification };
    }
  }
  if (config.businessHoursOnly && config.allowedStartTime && config.allowedEndTime) {
    if (!inWindow(now, config.timezone, config.allowedStartTime, config.allowedEndTime)) {
      return { eligible: false, reason: "OUTSIDE_SEND_WINDOW", classification };
    }
  }

  return { eligible: true, reason: null, classification };
}
