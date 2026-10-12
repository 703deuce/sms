import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import {
  getAppointmentRemindersWorkspaceConfig,
  type AppointmentRemindersWorkspaceConfig,
} from "@/lib/appointment-reminders/workspace-existing-sms-consent";

export type ArCalendarWriteBackSettings = {
  /** Default true when unset — workspace-level master switch. */
  enabled: boolean;
  /** Default true when unset — Outlook category labels for status colors. */
  colorCodingEnabled: boolean;
};

export function resolveArCalendarWriteBackSettings(
  platform: AppointmentPlatformConfig | null | undefined,
): ArCalendarWriteBackSettings {
  const ar = getAppointmentRemindersWorkspaceConfig(platform || ({} as AppointmentPlatformConfig));
  const raw = ar.calendarWriteBack as { enabled?: boolean } | undefined;
  const colorRaw = (ar.calendarWriteBack as { colorCodingEnabled?: boolean } | undefined)
    ?.colorCodingEnabled;
  return {
    enabled: raw?.enabled !== false,
    colorCodingEnabled: colorRaw !== false,
  };
}

export function patchArCalendarWriteBackSettings(
  current: AppointmentRemindersWorkspaceConfig,
  patch: Partial<ArCalendarWriteBackSettings>,
): AppointmentRemindersWorkspaceConfig {
  const prev = (current.calendarWriteBack || {}) as ArCalendarWriteBackSettings;
  return {
    ...current,
    calendarWriteBack: {
      ...prev,
      ...patch,
    },
  };
}
