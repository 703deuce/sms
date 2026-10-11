import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import { getAppointmentRemindersWorkspaceConfig } from "@/lib/appointment-reminders/workspace-existing-sms-consent";

export type ArOperationalPauseState = {
  pausedAt: string;
  pausedByUserId?: string | null;
  /** ISO instant — when set, reminders resume automatically after this time. */
  pausedUntil?: string | null;
  /** When true, reminders stay paused until explicit resume (pausedUntil ignored). */
  indefinite?: boolean;
  reason?: string | null;
};

export function getArOperationalPause(
  platform: AppointmentPlatformConfig | null | undefined,
): ArOperationalPauseState | null {
  const pause = getAppointmentRemindersWorkspaceConfig(platform || ({} as AppointmentPlatformConfig))
    .operationalPause;
  if (!pause?.pausedAt) return null;
  return pause;
}

export function isArRemindersPaused(
  platform: AppointmentPlatformConfig | null | undefined,
  now = new Date(),
): boolean {
  const pause = getArOperationalPause(platform);
  if (!pause) return false;
  if (pause.indefinite) return true;
  if (!pause.pausedUntil) return true;
  const until = Date.parse(pause.pausedUntil);
  if (!Number.isFinite(until)) return true;
  return now.getTime() < until;
}
