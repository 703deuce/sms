import { resolveContactDialPhone } from "./phone-resolve";
import { areaCodeAllowed, type WorkspaceDialPolicy } from "./dial-policy";
import type { CampaignAdvanced } from "./campaign-advanced";
import { retryDelayMinutesForAttempt } from "./campaign-advanced";
import { isCallingWindowOpen, resolveLegalHours, startOfDayInTimezone } from "./timezone-window";
import type {
  AttemptSummary,
  ContactForEligibility,
  EligibilityBucket,
  EligibilityReasonCode,
  EligibilityResult,
  PowerDialerCampaignRules,
} from "./types";

export type { EligibilityResult } from "./types";

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
  advanced?: CampaignAdvanced;
  workspaceFrequency?: { ok: boolean; reason?: string; retryEligibleAt?: Date };
  workspaceDialPolicy?: WorkspaceDialPolicy;
  /** Session setup screen — do not require active campaign or dial session for counts. */
  setupPreview?: boolean;
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
  if (!input.setupPreview) {
    if (rules.status !== "active") {
      return { eligible: false, bucket: "deferred", reason: "campaign_not_active" };
    }
    if (!sessionActive) {
      return { eligible: false, bucket: "failed", reason: "session_not_active" };
    }
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

  const advanced = input.advanced || {};
  const acCheck = areaCodeAllowed(
    e164,
    advanced.allowedAreaCodes || [],
    advanced.blockedAreaCodes || [],
    input.workspaceDialPolicy || {
      minMinutesBetweenCallsToPhone: 0,
      maxCallsToPhonePerDay: 0,
      allowedAreaCodes: [],
      blockedAreaCodes: [],
    },
  );
  if (!acCheck.ok) {
    return {
      eligible: false,
      bucket: "suppressed",
      reason: acCheck.reason === "area_code_not_allowed" ? "area_code_not_allowed" : "area_code_blocked",
    };
  }

  if (input.workspaceFrequency && !input.workspaceFrequency.ok) {
    const r = input.workspaceFrequency.reason;
    if (r === "workspace_phone_daily_cap") {
      return { eligible: false, bucket: "deferred", reason: "workspace_phone_daily_cap" };
    }
    return {
      eligible: false,
      bucket: "deferred",
      reason: "workspace_phone_cooldown",
      retryEligibleAt: input.workspaceFrequency.retryEligibleAt?.toISOString(),
    };
  }

  const openCallback = campaignAttemptsForContact.find(
    (a) => a.callbackAt && a.callbackAt > now && a.disposition?.toLowerCase() === "callback",
  );
  if (openCallback?.callbackAt && openCallback.callbackAt > now) {
    return {
      eligible: false,
      bucket: "deferred",
      reason: "callback_scheduled_future",
      retryEligibleAt: openCallback.callbackAt.toISOString(),
    };
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
  const completedCount = campaignAttemptsForContact.filter((a) => a.endedAt || a.disposition).length;
  const retryMin = retryDelayMinutesForAttempt(advanced, rules.retryIntervalMinutes, completedCount);
  const skipRetryForCallback =
    advanced.callbackExemptFromRetryDelay &&
    campaignAttemptsForContact.some((a) => a.callbackAt && a.callbackAt <= now);
  if (lastEnded?.endedAt && retryMin > 0 && !skipRetryForCallback) {
    const retryAt = new Date(lastEnded.endedAt.getTime() + retryMin * 60_000);
    if (now < retryAt) {
      return {
        eligible: false,
        bucket: "deferred",
        reason: "retry_delay_active",
        retryEligibleAt: retryAt.toISOString(),
      };
    }
  }

  const legal = resolveLegalHours(
    advanced.jurisdictionPreset,
    rules.callingHoursStart,
    rules.callingHoursEnd,
    advanced.customLegalStart,
    advanced.customLegalEnd,
  );
  const window = isCallingWindowOpen(
    now,
    tz,
    rules.allowedDays,
    legal.startHm,
    legal.endHm,
    advanced.scheduleBreaks || [],
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
    lead_owner_mismatch: "Assigned to another rep",
    area_code_blocked: "Area code blocked",
    area_code_not_allowed: "Area code not on allow list",
    workspace_phone_cooldown: "Workspace cooldown for this number",
    workspace_phone_daily_cap: "Workspace daily cap for this number",
    scheduled_break: "Campaign break window",
    jurisdiction_window_closed: "Outside legal calling hours",
    callback_scheduled_future: "Callback scheduled for later",
    removed_from_queue: "Removed from campaign queue",
  };
  return map[code] ?? code;
}
