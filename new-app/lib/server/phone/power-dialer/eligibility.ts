import { resolveContactDialPhone } from "./phone-resolve";
import { isCallingWindowOpen, startOfDayInTimezone } from "./timezone-window";
import type {
  AttemptSummary,
  ContactForEligibility,
  EligibilityBucket,
  EligibilityReasonCode,
  EligibilityResult,
  PowerDialerCampaignRules,
} from "./types";

const TERMINAL_DISPOSITIONS = new Set([
  "booked",
  "not interested",
  "wrong number",
  "do not call",
  "dnc",
]);

const LIVE_ATTEMPT_STATUSES = new Set(["pending", "dialing", "ringing", "answered"]);

export function dispositionIsTerminal(disposition: string | null | undefined): boolean {
  if (!disposition) return false;
  return TERMINAL_DISPOSITIONS.has(disposition.trim().toLowerCase());
}

export function evaluateContactEligibility(input: {
  contact: ContactForEligibility;
  rules: PowerDialerCampaignRules;
  campaignAttemptsForContact: AttemptSummary[];
  sessionAttemptsForContact: AttemptSummary[];
  now: Date;
  sessionActive: boolean;
  sessionPaused: boolean;
  hasOpenDispositionBlock: boolean;
  anyLiveAttemptInSession: boolean;
  repAuthorized: boolean;
  onInternalDnc?: boolean;
  usageBlocked?: boolean;
  sessionRepUserId?: string | null;
  leadOwnerRouting?: "off" | "assigned_only" | "allow_cross_rep";
}): EligibilityResult {
  const {
    contact,
    rules,
    campaignAttemptsForContact,
    sessionAttemptsForContact,
    now,
    sessionActive,
    sessionPaused,
    hasOpenDispositionBlock,
    anyLiveAttemptInSession,
    repAuthorized,
  } = input;

  if (!repAuthorized) {
    return { eligible: false, bucket: "failed", reason: "rep_not_authorized" };
  }
  if (input.usageBlocked) {
    return { eligible: false, bucket: "failed", reason: "usage_limit_reached" };
  }
  if (rules.status !== "active") {
    return { eligible: false, bucket: "deferred", reason: "campaign_not_active" };
  }
  if (!sessionActive) {
    return { eligible: false, bucket: "failed", reason: "session_not_active" };
  }
  if (sessionPaused) {
    return { eligible: false, bucket: "deferred", reason: "session_paused" };
  }
  if (hasOpenDispositionBlock) {
    return { eligible: false, bucket: "deferred", reason: "disposition_required" };
  }
  if (anyLiveAttemptInSession) {
    return { eligible: false, bucket: "deferred", reason: "live_attempt_in_progress" };
  }

  if (contact.status === "BLOCKED") {
    return { eligible: false, bucket: "suppressed", reason: "contact_blocked" };
  }
  if (contact.status === "UNSUBSCRIBED") {
    return { eligible: false, bucket: "suppressed", reason: "contact_unsubscribed" };
  }

  const ownerRouting = input.leadOwnerRouting || "off";
  if (ownerRouting === "assigned_only" && input.sessionRepUserId) {
    const owner = contact.ownerUserId || contact.assignedUser;
    if (owner && owner !== input.sessionRepUserId) {
      return { eligible: false, bucket: "deferred", reason: "lead_owner_mismatch" };
    }
  }

  const cf =
    contact.customFields && typeof contact.customFields === "object"
      ? (contact.customFields as Record<string, unknown>)
      : {};
  if (cf.powerDialerRemovedFromQueueAt) {
    return { eligible: false, bucket: "suppressed", reason: "removed_from_queue" };
  }
  if (cf.powerDialerCompletedAt) {
    return { eligible: false, bucket: "completed", reason: "contact_completed" };
  }

  const terminal = campaignAttemptsForContact.find((a) => dispositionIsTerminal(a.disposition));
  if (terminal) {
    return { eligible: false, bucket: "completed", reason: "contact_completed" };
  }

  const { e164 } = resolveContactDialPhone(contact, rules.phoneFieldPriority);
  if (!e164) {
    return { eligible: false, bucket: "failed", reason: "invalid_phone" };
  }
  if (input.onInternalDnc) {
    return { eligible: false, bucket: "suppressed", reason: "internal_dnc" };
  }

  const totalAttempts = campaignAttemptsForContact.filter((a) =>
    ["completed", "no_answer", "voicemail", "failed", "answered"].includes(a.status) ||
    a.disposition,
  ).length;
  if (totalAttempts >= rules.totalAttemptCap) {
    return { eligible: false, bucket: "completed", reason: "total_cap_reached" };
  }

  const tz = contact.timezone || rules.timezone;
  const dayStart = startOfDayInTimezone(now, tz);
  const attemptsToday = campaignAttemptsForContact.filter((a) => a.createdAt >= dayStart).length;
  if (attemptsToday >= rules.dailyAttemptCap) {
    return { eligible: false, bucket: "deferred", reason: "daily_cap_reached" };
  }

  const lastEnded = [...campaignAttemptsForContact]
    .filter((a) => a.endedAt)
    .sort((a, b) => (b.endedAt!.getTime() - a.endedAt!.getTime()))[0];
  if (lastEnded?.endedAt && rules.retryIntervalMinutes > 0) {
    const retryAt = new Date(lastEnded.endedAt.getTime() + rules.retryIntervalMinutes * 60_000);
    if (now < retryAt) {
      return {
        eligible: false,
        bucket: "deferred",
        reason: "retry_delay_active",
        retryEligibleAt: retryAt.toISOString(),
      };
    }
  }

  const window = isCallingWindowOpen(
    now,
    tz,
    rules.allowedDays,
    rules.callingHoursStart,
    rules.callingHoursEnd,
  );
  if (!window.open) {
    return { eligible: false, bucket: "deferred", reason: "calling_window_closed" };
  }

  const liveOnContact = sessionAttemptsForContact.some((a) => LIVE_ATTEMPT_STATUSES.has(a.status));
  if (liveOnContact) {
    return { eligible: false, bucket: "deferred", reason: "live_attempt_in_progress" };
  }

  return { eligible: true, bucket: "eligible", reason: "eligible" };
}

export function bucketLabel(bucket: EligibilityBucket): string {
  switch (bucket) {
    case "eligible":
      return "Eligible";
    case "deferred":
      return "Deferred";
    case "completed":
      return "Completed";
    case "suppressed":
      return "Suppressed";
    case "failed":
      return "Failed";
  }
}

export function reasonToUserMessage(code: EligibilityReasonCode): string {
  const map: Record<EligibilityReasonCode, string> = {
    eligible: "Ready to dial",
    not_in_campaign_list: "Not on this list",
    invalid_phone: "Invalid phone number",
    contact_blocked: "Do not call / blocked",
    contact_unsubscribed: "Unsubscribed",
    daily_cap_reached: "Daily attempt cap reached",
    total_cap_reached: "Max attempts reached",
    retry_delay_active: "Retry delay not elapsed",
    calling_window_closed: "Outside calling hours",
    live_attempt_in_progress: "Call in progress",
    campaign_not_active: "Campaign not active",
    session_not_active: "Session ended",
    session_paused: "Session paused",
    disposition_required: "Disposition required",
    contact_completed: "Contact completed",
    rep_not_authorized: "Not authorized",
    internal_dnc: "On workspace do-not-call list",
    usage_limit_reached: "Included minutes exhausted for this period",
  };
  return map[code] ?? code;
}
