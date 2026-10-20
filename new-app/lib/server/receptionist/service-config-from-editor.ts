import type { AgentConfig } from "@/lib/agent";
import type { VoiceV3ServiceConfig } from "@/lib/server/voice-v3/config/agent-config";

const SLOT_STEP = 15;

function bookingPermission(
  t: AgentConfig["appointments"]["types"][number],
  strategy: AgentConfig["appointments"]["strategy"],
): VoiceV3ServiceConfig["bookingPermission"] {
  if (t.booking === "request") return "request_only";
  if (strategy === "link") return "send_booking_link";
  return "book_directly";
}

export function voiceV3ServicesFromEditor(editor: AgentConfig): VoiceV3ServiceConfig[] {
  const strategy = editor.appointments.strategy;
  return editor.appointments.types
    .filter((t) => t.enabled)
    .map((t) => ({
      id: t.id,
      name: t.name?.trim() || t.id,
      durationMinutes: t.duration > 0 ? t.duration : 30,
      slotStepMinutes: SLOT_STEP,
      description: t.location?.trim() || undefined,
      enabled: true,
      location: t.location,
      modality: t.modality,
      bookingPermission: bookingPermission(t, strategy),
      minimumBookingNoticeMinutes: Math.max(0, (t.noticeHours ?? 0) * 60),
      maximumBookingDaysAhead: t.advanceDays ?? 0,
      requiredIntakeKeys: (t.requiredFields ?? []).map((k) => k.trim()).filter(Boolean),
      bookingHoursProse: t.hours?.trim() || undefined,
    }));
}
