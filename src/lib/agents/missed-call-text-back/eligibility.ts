import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  classificationTriggersMctb,
  type ClassifyInboundCallInput,
  classifyInboundCallOutcome,
} from "./classify";
import { loadMissedCallTextConfig } from "./config";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { evaluateCallerIdForMctb } from "@/lib/mctb/spam-filter";
import { mctbCallerE164Variants } from "@/lib/mctb/messaging/caller-e164";
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
  eventOnly?: boolean;
  forwardedFromE164?: string | null;
  transovoNumberE164?: string | null;
  eventMetadata?: Record<string, unknown>;
}): Promise<EligibilityResult> {
  const config = await loadMissedCallTextConfig(input.workspaceId);
  const classification = classifyInboundCallOutcome(input.call);

  let caller = "";
  try {
    caller = normalizeE164(input.callerE164);
  } catch {
    return { eligible: false, reason: "INVALID_PHONE", classification };
  }
  if (!caller || caller.length < 8) {
    return { eligible: false, reason: "INVALID_PHONE", classification };
  }

  const testRecovery = !input.demoMode
    ? await import("@/lib/mctb/onboarding/test-recovery-context").then((m) =>
        m.isMctbTestRecoveryContext(input.workspaceId, input.eventMetadata),
      )
    : false;

  if (!input.demoMode) {
    if (!config.enabled) {
      return { eligible: false, reason: "FEATURE_DISABLED", classification };
    }

    const entitlement = await getMctbEntitlement(input.workspaceId);
    if (!testRecovery && !entitlement.canSendAutomaticRecovery) {
      const onboardingLiveTestAuthorized =
        entitlement.serviceStatus === "ONBOARDING" &&
        entitlement.reason === "onboarding" &&
        (await import("@/lib/mctb/onboarding/live-test-recovery-send").then((m) =>
          m.authorizeOnboardingLiveTestRecoverySend({
            workspaceId: input.workspaceId,
            idempotencyKey: input.idempotencyKey,
            callerE164: input.callerE164,
            businessE164: input.businessE164,
            phoneNumberId: input.phoneNumberId,
            forwardedFromE164: input.forwardedFromE164,
          }),
        ));
      if (!onboardingLiveTestAuthorized) {
        return {
          eligible: false,
          reason:
            entitlement.reason === "trial_sms_limit_reached"
              ? "TRIAL_SMS_LIMIT"
              : entitlement.reason === "mctb_recovery_limit_reached"
                ? "MCTB_RECOVERY_LIMIT"
                : "ENTITLEMENT_SUSPENDED",
          classification,
        };
      }
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
      const prisma = getPrisma();
      const calledIngress = await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, status: true },
      });
      if (
        !calledIngress ||
        String(calledIngress.status || "").toLowerCase() === "released"
      ) {
        return { eligible: false, reason: "TRIGGER_DISABLED", classification };
      }
      // Called DID is still workspace-owned (e.g. customer forwards to an earlier ingress TFN).
      // Do not suppress recovery — carriers often omit ForwardedFrom on status callbacks.
    }

    if (config.suppressKnownSpam) {
      const spam = evaluateCallerIdForMctb(caller);
      if (spam.blocked) {
        return {
          eligible: false,
          reason: spam.reason === "SPAM" ? "SPAM" : spam.reason || "UNKNOWN_CALLER",
          classification,
        };
      }
    }
  }

  const prisma = getPrisma();
  const existing = await prisma.missedCallEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing?.smsSentAt || existing?.status === "SENT") {
    return { eligible: false, reason: "ALREADY_SENT", classification };
  }

  if (config.suppressBlockedNumbers) {
    const blockedVariants = mctbCallerE164Variants(caller);
    const blocked = await prisma.suppression.findFirst({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { phone: { in: blockedVariants } },
          ...blockedVariants.map((v) => ({
            suppressionKey: `${input.workspaceId}:p:${v}`,
          })),
        ],
      },
    });
    if (blocked) {
      return { eligible: false, reason: "BLOCKED_NUMBER", classification };
    }
  }

  if (config.suppressOptedOutNumbers) {
    const optOutVariants = mctbCallerE164Variants(caller);
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: { in: optOutVariants } },
      select: { status: true },
    });
    if (contact && contact.status !== "SUBSCRIBED") {
      return { eligible: false, reason: "OPTED_OUT", classification };
    }
  }

  if (config.senderMode === "PLATFORM" && config.suppressOptedOutNumbers) {
    const { resolveCanonicalMctbPlatformSender } = await import(
      "@/lib/mctb/messaging/platform-sender-config"
    );
    const { isPlatformMctbSenderOptedOut } = await import(
      "@/lib/mctb/messaging/platform-sender-suppression"
    );
    const platform = await resolveCanonicalMctbPlatformSender();
    if (platform && (await isPlatformMctbSenderOptedOut(platform, caller))) {
      return { eligible: false, reason: "OPTED_OUT", classification };
    }
  }

  const cooldownSince = new Date(Date.now() - config.cooldownMinutes * 60_000);
  const skipCooldown =
    testRecovery ||
    input.eventMetadata?.testSms === true ||
    input.eventMetadata?.liveTest === true ||
    input.eventMetadata?.certMode === "C" ||
    input.eventMetadata?.certMode === "C3" ||
    config.cooldownMinutes <= 0;
  if (!skipCooldown) {
    const callerVariants = mctbCallerE164Variants(caller);
    const recentSent = await prisma.missedCallEvent.count({
      where: {
        workspaceId: input.workspaceId,
        callerE164: { in: callerVariants },
        smsSentAt: { gte: cooldownSince },
      },
    });
    if (recentSent >= config.maxMessagesPerCaller) {
      return { eligible: false, reason: "COOLDOWN_ACTIVE", classification };
    }
  }

  if (!input.demoMode && !testRecovery) {
    const { loadMctbScheduleSettings, isMctbSchedulePaused, isWithinMctbSendWindow } =
      await import("@/lib/mctb/schedule");
    const scheduleSettings = await loadMctbScheduleSettings(input.workspaceId, config);
    if (isMctbSchedulePaused(scheduleSettings, config)) {
      return { eligible: false, reason: "MCTB_DISABLED", classification };
    }
    const now = new Date();
    if (!isWithinMctbSendWindow(now, config, scheduleSettings)) {
      return { eligible: false, reason: "OUTSIDE_SEND_WINDOW", classification };
    }
  }

  return { eligible: true, reason: null, classification };
}
