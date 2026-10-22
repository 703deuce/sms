import type {
  AfterHoursBehaviorConfig,
  BusinessScheduleConfig,
  CallbackSlaPolicy,
  CustomCoverageSchedule,
  OperatingMaturityConfig,
  OnCallScheduleConfig,
} from "@/lib/agent";

const weekdayOpen: BusinessScheduleConfig["weekly"]["monday"] = {
  closed: false,
  ranges: [{ start: "08:00", end: "18:00" }],
};

export const DEFAULT_BUSINESS_SCHEDULE: BusinessScheduleConfig = {
  timezone: "America/Chicago",
  weekly: {
    monday: weekdayOpen,
    tuesday: weekdayOpen,
    wednesday: weekdayOpen,
    thursday: weekdayOpen,
    friday: weekdayOpen,
    saturday: { closed: false, ranges: [{ start: "09:00", end: "14:00" }] },
    sunday: { closed: true, ranges: [] },
  },
  holidays: [],
};

export const DEFAULT_AFTER_HOURS_BEHAVIOR: AfterHoursBehaviorConfig = {
  useOperatingStateDuringCalls: true,
  whenClosed: {
    allowLiveBooking: true,
    allowCallbackRequest: true,
    allowMessageTaking: true,
    allowOnCallEscalation: true,
    allowOfficeTransfer: false,
    allowNormalTransferDestinations: false,
  },
};

export const DEFAULT_ON_CALL_SCHEDULE: OnCallScheduleConfig = {
  enabled: false,
  timezone: "America/Chicago",
  entries: [],
};

export const DEFAULT_CALLBACK_SLA: CallbackSlaPolicy = {
  normalTarget: "1h",
  urgentTarget: "30m",
};

export const DEFAULT_OPERATING_MATURITY: OperatingMaturityConfig = {
  revision: "v1",
  businessSchedule: DEFAULT_BUSINESS_SCHEDULE,
  afterHoursBehavior: DEFAULT_AFTER_HOURS_BEHAVIOR,
  onCallSchedule: DEFAULT_ON_CALL_SCHEDULE,
  callbackSla: DEFAULT_CALLBACK_SLA,
};

export const DEFAULT_CUSTOM_COVERAGE: CustomCoverageSchedule = {
  ...DEFAULT_BUSINESS_SCHEDULE,
};

export const DEFAULT_TRANSFER_ADVANCED = {
  ringSeconds: 30,
  globalFallback: "message",
  routing: "single",
  detectVoicemailOnTransfer: true,
  humanTransferEnabled: true,
  planSteps: [],
};
