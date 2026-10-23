export type DialingMode = "power" | "preview";

export type EligibilityBucket = "eligible" | "deferred" | "completed" | "suppressed" | "failed";

export type EligibilityReasonCode =
  | "eligible"
  | "not_in_campaign_list"
  | "invalid_phone"
  | "contact_blocked"
  | "contact_unsubscribed"
  | "daily_cap_reached"
  | "total_cap_reached"
  | "retry_delay_active"
  | "calling_window_closed"
  | "live_attempt_in_progress"
  | "campaign_not_active"
  | "session_not_active"
  | "session_paused"
  | "disposition_required"
  | "contact_completed"
  | "rep_not_authorized"
  | "internal_dnc"
  | "usage_limit_reached";

export type AnswerClassification =
  | "human"
  | "voicemail"
  | "no_answer"
  | "screener"
  | "ivr"
  | "fax"
  | "uncertain"
  | "failed";

export type ProgressionPhase =
  | "idle"
  | "countdown"
  | "dialing"
  | "awaiting_disposition"
  | "ended";

export type PowerDialerCampaignRules = {
  ringTimeoutSeconds: number;
  retryIntervalMinutes: number;
  dailyAttemptCap: number;
  totalAttemptCap: number;
  postCallIntervalSeconds: number;
  requireDispositionBeforeNext: boolean;
  allowedDays: number[];
  callingHoursStart: string;
  callingHoursEnd: string;
  phoneFieldPriority: string[];
  dialingMode: DialingMode;
  timezone: string;
  status: string;
};

export type ContactForEligibility = {
  id: string;
  phone: string;
  status: string;
  timezone: string | null;
  customFields: unknown;
};

export type AttemptSummary = {
  contactId: string;
  status: string;
  disposition: string | null;
  attemptNumber: number;
  createdAt: Date;
  endedAt: Date | null;
  callbackAt?: Date | null;
};

export type EligibilityResult = {
  eligible: boolean;
  bucket: EligibilityBucket;
  reason: EligibilityReasonCode;
  retryEligibleAt?: string;
};
