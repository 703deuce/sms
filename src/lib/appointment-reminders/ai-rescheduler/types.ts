import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import type { ArSmsActionPolicyConfig } from "./ar-sms-action-policy";
import { buildArReplyInstructionsSuffix } from "./ar-sms-action-policy";

/** How outbound reminders and customer change requests are handled. */
export type AiReschedulerMode = "reminders_only" | "notify" | "ai";

export type AiReschedulerApproval = "automatic" | "business";

export type AiReschedulerDayConfig = {
  enabled: boolean;
  open: string;
  close: string;
};

export type AiReschedulerConfig = {
  /**
   * `reminders_only` — send template SMS/email only (no C/R/X suffix or inbound change handling).
   * `notify` — include reply actions; staff notified on cancel/reschedule requests.
   * `ai` — AI offers times and applies calendar changes per approval rules.
   */
  mode: AiReschedulerMode;
  approval: AiReschedulerApproval;
  weeklyHours: Record<string, AiReschedulerDayConfig>;
  durationMode: "original" | "fixed";
  fixedDurationMinutes?: number;
  minimumNoticeMinutes: number;
  maximumDaysAhead: number;
  bufferMinutes: number;
  /**
   * Legacy reschedule cutoff (minutes before start). Prefer `rescheduleSmsPolicy.cutoffMinutes`.
   */
  rescheduleSmsCutoffMinutes?: number;
  rescheduleSmsPolicy?: ArSmsActionPolicyConfig;
  cancelSmsCutoffMinutes?: number;
  cancelSmsPolicy?: ArSmsActionPolicyConfig;
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
  if (input.config.mode === "reminders_only") return "";
  return buildArReplyInstructionsSuffix(input);
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

function normalizeAiReschedulerMode(mode: unknown): AiReschedulerMode {
  if (mode === "reminders_only" || mode === "notify" || mode === "ai") return mode;
  return DEFAULT_AI_RESCHEDULER_CONFIG.mode;
}

export function resolveAiReschedulerConfig(
  platform: AppointmentPlatformConfig,
): AiReschedulerConfig {
  const raw = platform.aiRescheduler;
  if (!raw) return { ...DEFAULT_AI_RESCHEDULER_CONFIG };
  return {
    ...DEFAULT_AI_RESCHEDULER_CONFIG,
    ...raw,
    mode: normalizeAiReschedulerMode(raw.mode),
    weeklyHours: { ...DEFAULT_AI_RESCHEDULER_WEEKLY_HOURS, ...(raw.weeklyHours || {}) },
  };
}

/** Customer SMS reply handling (C/R/X suffix + inbound pipeline). False for reminders-only. */
export function isAiReschedulerSmsEnabled(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" || config.mode === "notify";
}

export function isArRemindersOnlyMode(config: AiReschedulerConfig): boolean {
  return config.mode === "reminders_only";
}

export function isAiAutomaticCalendarMutation(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" && config.approval === "automatic";
}

export function isAiBusinessApprovalMode(config: AiReschedulerConfig): boolean {
  return config.mode === "ai" && config.approval === "business";
}
