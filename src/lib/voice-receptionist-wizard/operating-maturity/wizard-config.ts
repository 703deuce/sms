import {
  DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG,
} from "./defaults";
import type {
  VoiceV2BusinessScheduleConfig,
  VoiceV2OperatingMaturityPublishedConfig,
} from "./types";

/** Parse pinned operating-maturity config from agent advanced / wizard snapshot. */
export function resolveOperatingMaturityFromAgentAdvanced(
  advanced?: Record<string, unknown> | null,
): VoiceV2OperatingMaturityPublishedConfig {
  const base = DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG;
  if (!advanced) return base;
  const wizard = advanced.appointmentReceptionistWizard as Record<string, unknown> | undefined;
  const raw =
    (advanced.voiceV2OperatingMaturity as Record<string, unknown> | undefined) ||
    (wizard?.operatingMaturity as Record<string, unknown> | undefined);
  if (!raw || typeof raw !== "object") {
    const schedule = parseLegacyBusinessSchedule(wizard, advanced);
    if (schedule) {
      return { ...base, businessSchedule: schedule, revision: "wizard-legacy-v1" };
    }
    return base;
  }
  return {
    revision: String(raw.revision || base.revision),
    businessSchedule: mergeSchedule(base.businessSchedule, raw.businessSchedule),
    afterHoursBehavior: {
      ...base.afterHoursBehavior,
      ...(raw.afterHoursBehavior as object),
      whenClosed: {
        ...base.afterHoursBehavior.whenClosed,
        ...((raw.afterHoursBehavior as Record<string, unknown>)?.whenClosed as object),
      },
    },
    onCallSchedule: {
      ...base.onCallSchedule,
      ...(raw.onCallSchedule as object),
      entries: Array.isArray((raw.onCallSchedule as Record<string, unknown>)?.entries)
        ? ((raw.onCallSchedule as Record<string, unknown>).entries as [])
        : base.onCallSchedule.entries,
    },
    callbackSla: {
      ...base.callbackSla,
      ...(raw.callbackSla as object),
    },
  };
}

function mergeSchedule(
  base: VoiceV2BusinessScheduleConfig,
  partial: unknown,
): VoiceV2BusinessScheduleConfig {
  if (!partial || typeof partial !== "object") return base;
  const p = partial as Record<string, unknown>;
  return {
    timezone: String(p.timezone || base.timezone),
    weekly: { ...base.weekly, ...(p.weekly as object) },
    holidays: Array.isArray(p.holidays) ? (p.holidays as VoiceV2BusinessScheduleConfig["holidays"]) : base.holidays,
    temporaryClosure:
      p.temporaryClosure === null
        ? null
        : p.temporaryClosure
          ? (p.temporaryClosure as VoiceV2BusinessScheduleConfig["temporaryClosure"])
          : base.temporaryClosure,
  };
}

function parseLegacyBusinessSchedule(
  wizard?: Record<string, unknown>,
  advanced?: Record<string, unknown>,
): VoiceV2BusinessScheduleConfig | null {
  const tz = String(wizard?.timezone || advanced?.business_timezone || "").trim();
  if (!tz) return null;
  return {
    ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule,
    timezone: tz,
  };
}

export function operatingMaturityConfigHash(config: VoiceV2OperatingMaturityPublishedConfig): string {
  return JSON.stringify({
    revision: config.revision,
    schedule: config.businessSchedule,
    behavior: config.afterHoursBehavior,
    onCall: config.onCallSchedule,
    sla: config.callbackSla,
  });
}
