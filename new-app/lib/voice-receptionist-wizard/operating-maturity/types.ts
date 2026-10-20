/** Voice V2 after-hours operating maturity — shared types (client + server). */

export type VoiceV2OperatingState =
  | "OPEN"
  | "CLOSED_AFTER_HOURS"
  | "WEEKEND"
  | "HOLIDAY"
  | "TEMPORARILY_CLOSED"
  | "OVERFLOW"
  | "UNKNOWN";

export type VoiceV2OperatingStateSource =
  | "WEEKLY_SCHEDULE"
  | "WEEKEND"
  | "HOLIDAY_OVERRIDE"
  | "TEMPORARY_CLOSURE"
  | "OVERFLOW_FLAG"
  | "UNKNOWN";

export type VoiceV2ResolvedOperatingState = {
  state: VoiceV2OperatingState;
  source: VoiceV2OperatingStateSource;
  reason?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  resolvedAt: string;
};

export type VoiceV2DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type VoiceV2TimeRange = {
  start: string; // HH:mm 24h
  end: string;
};

export type VoiceV2WeeklyDaySchedule = {
  closed: boolean;
  ranges: VoiceV2TimeRange[];
};

export type VoiceV2HolidayClosure = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  closedAllDay: boolean;
  ranges?: VoiceV2TimeRange[];
};

export type VoiceV2TemporaryClosure = {
  active: boolean;
  startsAt: string;
  endsAt: string;
  reason?: string;
};

export type VoiceV2BusinessScheduleConfig = {
  timezone: string;
  weekly: Partial<Record<VoiceV2DayOfWeek, VoiceV2WeeklyDaySchedule>>;
  holidays: VoiceV2HolidayClosure[];
  temporaryClosure?: VoiceV2TemporaryClosure | null;
};

export type VoiceV2AfterHoursBehaviorConfig = {
  useOperatingStateDuringCalls: boolean;
  whenClosed: {
    allowLiveBooking: boolean;
    allowCallbackRequest: boolean;
    allowMessageTaking: boolean;
    allowOnCallEscalation: boolean;
    allowOfficeTransfer: boolean;
    allowNormalTransferDestinations: boolean;
  };
};

export type VoiceV2OnCallDestination = {
  label: string;
  phoneE164?: string;
  contactId?: string;
  transferPlanId?: string | null;
};

export type VoiceV2OnCallScheduleEntry = {
  id: string;
  name?: string;
  /** IANA weekday 0=Sunday … 6=Saturday OR date-specific when date set */
  dayOfWeek?: number;
  date?: string;
  startTime: string;
  endTime: string;
  destination: VoiceV2OnCallDestination;
  priority: number;
  enabled: boolean;
};

export type VoiceV2OnCallScheduleConfig = {
  enabled: boolean;
  timezone: string;
  entries: VoiceV2OnCallScheduleEntry[];
};

export type VoiceV2OnCallOperationalOverride = {
  label: string;
  destination: VoiceV2OnCallDestination;
  effectiveUntil: string;
  reason?: string;
};

export type VoiceV2CallbackSlaPolicy = {
  normalTarget: "30m" | "1h" | "next_business_day" | "custom";
  normalCustomMinutes?: number;
  urgentTarget: "immediate" | "15m" | "30m" | "custom";
  urgentCustomMinutes?: number;
};

export type VoiceV2OperatingMaturityPublishedConfig = {
  revision: string;
  businessSchedule: VoiceV2BusinessScheduleConfig;
  afterHoursBehavior: VoiceV2AfterHoursBehaviorConfig;
  onCallSchedule: VoiceV2OnCallScheduleConfig;
  callbackSla: VoiceV2CallbackSlaPolicy;
};

export type VoiceV2ActiveOnCallTarget = {
  entryId: string;
  label: string;
  phoneE164?: string;
  contactId?: string;
  transferPlanId?: string | null;
  source: "SCHEDULE" | "OPERATIONAL_OVERRIDE";
};

export type VoiceV2ResolutionAuditStatus =
  | "RESOLVED_SUCCESS"
  | "RESOLVED_INFORMATION_ONLY"
  | "PARTIALLY_RESOLVED"
  | "ABANDONED_BEFORE_INTENT"
  | "ABANDONED_DURING_INTAKE"
  | "ABANDONED_DURING_BOOKING"
  | "ABANDONED_DURING_TRANSFER"
  | "AI_UNABLE_TO_HELP"
  | "PROVIDER_FAILURE"
  | "TRANSFER_FAILURE"
  | "AI_REFUSAL"
  | "NON_CUSTOMER_CALL"
  | "UNRESOLVED_ABANDONED"
  | "DECLINED_AI_CHANNEL";

export type VoiceV2FrictionSignalType =
  | "AI_REFUSAL"
  | "HUMAN_REQUEST"
  | "FRUSTRATION"
  | "REPEATED_MISUNDERSTANDING"
  | "REPEATED_REASK"
  | "EARLY_ABANDONMENT"
  | "INTERRUPTION_FAILURE"
  | "AGENT_TALKOVER"
  | "CALLER_TALKOVER"
  | "LONG_SILENCE"
  | "TOOL_WAIT_FRICTION";

export type VoiceV2FrictionSignal = {
  type: VoiceV2FrictionSignalType;
  confidence: number;
  severity: "low" | "medium" | "high";
  evidence?: string;
  measuredAt?: string;
};

export type QualityStudioScenarioResult = {
  scenarioId: string;
  status: "PASS" | "WARNING" | "FAIL" | "NOT_APPLICABLE";
  expected: string;
  observed: string;
  reason?: string;
};

export type VoiceV2CallQualityRecord = {
  primaryOutcome: string;
  resolutionStatus: VoiceV2ResolutionAuditStatus;
  operatingState?: VoiceV2OperatingState;
  frictionSignals: VoiceV2FrictionSignal[];
  recoveryStatus?: string;
  callbackStatus?: string;
  humanRequested?: boolean;
  aiRefusal?: boolean;
  providerFailure?: boolean;
  transferFailure?: boolean;
  recordCompleteness?: number;
};

export type QualityStudioScenarioResult = {
  scenarioId: string;
  status: "PASS" | "WARNING" | "FAIL" | "NOT_APPLICABLE";
  expected: string;
  observed: string;
  reason?: string;
};
