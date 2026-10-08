import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { BusinessHoursWindow } from "@/lib/voice-v3/calendar/types";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import { defaultNestedFromFlat } from "@/lib/voice-v3/config/default-nested-config";
import { resolveWriteCalendarId, type CalendarConfig } from "@/lib/calendar/providers";
import { providerRefFromAppointment } from "../provider-mutations";
import { resolveAiReschedulerConfig, type AiReschedulerDayConfig } from "../types";

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function arWeeklyToBusinessWindow(
  weeklyHours: Record<string, AiReschedulerDayConfig>,
): BusinessHoursWindow {
  const weekdays: number[] = [];
  for (let i = 0; i < DAY_KEYS.length; i++) {
    const key = DAY_KEYS[i]!;
    if (weeklyHours[key]?.enabled) weekdays.push(i);
  }
  const enabled = Object.values(weeklyHours).filter((d) => d.enabled);
  const open = enabled[0]?.open || "09:00";
  const close = enabled[0]?.close || "17:00";
  return { weekdays, startLocal: open, endLocal: close };
}

/**
 * Voice V3 agent config scoped to one AR appointment (calendar + duration + hours).
 */
export async function buildArVoiceV3AgentConfig(input: {
  workspaceId: string;
  appointmentId: string;
}): Promise<VoiceV3AgentConfig | null> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!row) return null;

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const ref = providerRefFromAppointment(row);
  if (!ref) return null;

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: input.workspaceId },
  });
  if (!conn) return null;

  const calendarConfig = (conn.config || {}) as CalendarConfig;
  const calendarIds = calendarConfig.importCalendarIds?.length
    ? [...calendarConfig.importCalendarIds]
    : [resolveWriteCalendarId(calendarConfig)];

  const durationMinutes =
    ar.durationMode === "fixed" && ar.fixedDurationMinutes
      ? ar.fixedDurationMinutes
      : Math.max(15, Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000) || 30);

  const service = {
    id: `ar_appt_${row.id}`,
    name: row.serviceName || "Appointment",
    durationMinutes,
    slotStepMinutes: 15,
    minimumBookingNoticeMinutes: ar.minimumNoticeMinutes,
    maximumBookingDaysAhead: ar.maximumDaysAhead,
  };

  const nested = defaultNestedFromFlat({
    businessName: "Business",
    timezone: platform.timezone,
    service,
    agentName: "Luna",
  });

  return {
    businessName: "Business",
    timezone: platform.timezone,
    intake: { objectiveDescription: "Appointment reminder SMS reschedule." },
    intakeFields: [],
    operationRequirements: {
      find_availability: [],
      book_appointment: [],
      reschedule_appointment: [],
      cancel_appointment: [],
    },
    service,
    businessHours: arWeeklyToBusinessWindow(ar.weeklyHours),
    calendar: {
      provider: ref.provider === "google" ? "google" : "microsoft",
      connectionId: ref.connectionId,
      calendarIds,
      smtp: null,
    },
    ...nested,
    services: nested.services,
    source: "ar_sms_reschedule",
  };
}
