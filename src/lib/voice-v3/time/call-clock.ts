import { formatBusinessLocalDateTime } from "../prompts/business-local-time";

export interface VoiceV3CallClock {
  nowUtc: string;
  nowLocal: string;
  localDate: string;
  timezone: string;
}

/** Authoritative call clock — never ask the model what day it is. */
export function buildVoiceV3CallClock(timezone: string, at: Date = new Date()): VoiceV3CallClock {
  const nowUtc = at.toISOString();
  const nowLocal = formatBusinessLocalDateTime(timezone, at);
  const localDate = nowLocal.slice(0, 10);

  return {
    nowUtc,
    nowLocal,
    localDate,
    timezone,
  };
}
