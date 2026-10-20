import type { DayOfWeek } from "@/lib/agent";

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

export type VoiceV2DayOfWeek = DayOfWeek;

export type VoiceV2TemporaryClosure = {
  active: boolean;
  startsAt: string;
  endsAt: string;
  reason?: string;
};

export type VoiceV2ActiveOnCallTarget = {
  entryId: string;
  label: string;
  phoneE164?: string;
  contactId?: string;
  transferPlanId?: string | null;
  source: "SCHEDULE" | "OPERATIONAL_OVERRIDE";
};

export type VoiceV2OnCallOperationalOverride = {
  label: string;
  destination: {
    label: string;
    phoneE164?: string;
    contactId?: string;
    transferPlanId?: string | null;
  };
  effectiveUntil: string;
  reason?: string;
};
