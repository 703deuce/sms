import type {
  VoiceV2AfterHoursBehaviorConfig,
  VoiceV2BusinessScheduleConfig,
  VoiceV2CallbackSlaPolicy,
  VoiceV2OnCallScheduleConfig,
  VoiceV2OperatingMaturityPublishedConfig,
} from "./types";

const defaultWeekday: VoiceV2BusinessScheduleConfig["weekly"]["monday"] = {
  closed: false,
  ranges: [{ start: "09:00", end: "17:00" }],
};

export const DEFAULT_VOICE_V2_BUSINESS_SCHEDULE: VoiceV2BusinessScheduleConfig = {
  timezone: "America/New_York",
  weekly: {
    monday: defaultWeekday,
    tuesday: defaultWeekday,
    wednesday: defaultWeekday,
    thursday: defaultWeekday,
    friday: defaultWeekday,
    saturday: { closed: true, ranges: [] },
    sunday: { closed: true, ranges: [] },
  },
  holidays: [],
  temporaryClosure: null,
};

export const DEFAULT_VOICE_V2_AFTER_HOURS_BEHAVIOR: VoiceV2AfterHoursBehaviorConfig = {
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

export const DEFAULT_VOICE_V2_ON_CALL_SCHEDULE: VoiceV2OnCallScheduleConfig = {
  enabled: false,
  timezone: "America/New_York",
  entries: [],
};

export const DEFAULT_VOICE_V2_CALLBACK_SLA: VoiceV2CallbackSlaPolicy = {
  normalTarget: "1h",
  urgentTarget: "30m",
};

export const DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG: VoiceV2OperatingMaturityPublishedConfig =
  {
    revision: "v1",
    businessSchedule: DEFAULT_VOICE_V2_BUSINESS_SCHEDULE,
    afterHoursBehavior: DEFAULT_VOICE_V2_AFTER_HOURS_BEHAVIOR,
    onCallSchedule: DEFAULT_VOICE_V2_ON_CALL_SCHEDULE,
    callbackSla: DEFAULT_VOICE_V2_CALLBACK_SLA,
  };
