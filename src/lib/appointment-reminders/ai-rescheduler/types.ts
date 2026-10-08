import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import {
  evaluateArRescheduleSmsCutoff,
  resolveArRescheduleSmsCutoffMinutes,
} from "./reschedule-sms-cutoff";

export type AiReschedulerMode = "notify" | "ai";

export type AiReschedulerApproval = "automatic" | "business";

export type AiReschedulerDayConfig = {
  enabled: boolean;
  open: string;
  close: string;
};

export type AiReschedulerConfig = {
  /** When false, only passive reminder copy may apply; default behavior is notify-only semantics. */
  mode: AiReschedulerMode;
  approval: AiReschedulerApproval;
  weeklyHours: Record<string, AiReschedulerDayConfig>;
  durationMode: "original" | "fixed";
  fixedDurationMinutes?: number;
  minimumNoticeMinutes: number;
  maximumDaysAhead: number;
  bufferMinutes: number;
  /**
   * Customer cannot reply R (and reminders omit R) when the appointment starts sooner than this many minutes.
   * 0 = no cutoff (always offer reschedule when AR SMS is enabled).
   */
  rescheduleSmsCutoffMinutes?: number;
  /** When true, X may cancel/delete provider event per policy; otherwise Transovo-only + notify business. */
  allowProviderCancel: boolean;
};

export const AR_REPLY_INSTRUCTIONS_SUFFIX =
  " Reply C to confirm, R to reschedule, or X to cancel.";

export const AR_REPLY_INSTRUCTIONS_CONFIRM_CANCEL =
  " Reply C to confirm or X to cancel.";

export function arReplyInstructionsSuffixForAppointment(input: {
  config: AiReschedulerConfig;
  startsAt: Date;
  now?: Date;
}): string {
  const cutoffMinutes = resolveArRescheduleSmsCutoffMinutes(input.config);
  const { allowed } = evaluateArRescheduleSmsCutoff({
    startsAt: input.startsAt,
    cutoffMinutes,
    now: input.now,
  });
  return allowed ? AR_REPLY_INSTRUCTIONS_SUFFIX : AR_REPLY_INSTRUCTIONS_CONFIRM_CANCEL;
}

export const DEFAULT_AI_RESCHEDULER_WEEKLY_HOURS: Record<string, AiReschedulerDayConfig> = {
  monday: { enabled: true, open: "09:00", close: "17:00" },
  tuesday: { enabled: true, open: "09:00", close: "17:00" },
  wednesday: { enabled: true, open: "09:00", close: "17:00" },
  thursday: { enabled: true, open: "09:00", close: "17:00" },
  friday: { enabled: true, open: "09:00", close: "17:00" },
  saturday: { enabled: false, open: "09:00", close: "12:00" },
  sunday: { enabled: false, open: "09:00", close: "12:00" },
};

export const DEFAULT_AI_RESCHEDULER_CONFIG: AiReschedulerConfig = {
  mode: "notify",
  approval: "automatic",
  weeklyHours: DEFAULT_AI_RESCHEDULER_WEEKLY_HOURS,
  durationMode: "original",
  minimumNoticeMinutes: 120,
  maximumDaysAhead: 60,
  bufferMinutes: 0,
  allowProviderCancel: false,
};

export function resolveAiReschedulerConfig(
  platform: AppointmentPlatformConfig,
): AiReschedulerConfig {
  const raw = platform.aiRescheduler;
  if (!raw) return { ...DEFAULT_AI_RESCHEDULER_CONFIG };
  return {
    ...DEFAULT_AI_RESCHEDULER_CONFIG,
    ...raw,
    weeklyHours: { ...DEFAULT_AI_RESCHEDULER_WEEKLY_HOURS, ...(raw.weeklyHours || {}) },
  };
}

export function isAiReschedulerSmsEnabled(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" || config.mode === "notify";
}

export function isAiAutomaticCalendarMutation(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" && config.approval === "automatic";
}

export function isAiBusinessApprovalMode(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" && config.approval === "business";
}
