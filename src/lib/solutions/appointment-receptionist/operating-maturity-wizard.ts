import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-v2/operating-maturity/defaults";
import type { VoiceV2OperatingMaturityPublishedConfig } from "@/lib/voice-v2/operating-maturity/types";
import type { AppointmentReceptionistWizardState } from "./types";

export function ensureWizardOperatingMaturity(
  state: Pick<AppointmentReceptionistWizardState, "operatingMaturity" | "timezone">,
): VoiceV2OperatingMaturityPublishedConfig {
  const tz =
    state.operatingMaturity?.businessSchedule?.timezone ||
    state.timezone ||
    DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule.timezone;

  const base = state.operatingMaturity ?? DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;

  return {
    ...base,
    revision: base.revision || "v1",
    businessSchedule: {
      ...base.businessSchedule,
      timezone: tz,
    },
    onCallSchedule: {
      ...base.onCallSchedule,
      timezone: base.onCallSchedule?.timezone || tz,
    },
  };
}
