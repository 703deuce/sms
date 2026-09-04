import type { SchedulingIntent, TimeOfDayPreference } from "./intent-schema";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function parseDayReference(text: string, now = new Date()): string | undefined {
  const lower = text.toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (lower.includes("today")) {
    return today.toISOString().slice(0, 10);
  }
  if (lower.includes("tomorrow")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (lower.includes(DAY_NAMES[i])) {
      const target = i;
      const current = today.getDay();
      let diff = target - current;
      if (diff <= 0) diff += 7;
      const d = new Date(today);
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }
  }

  if (lower.includes("next week")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  return undefined;
}

function parseTimeOfDay(text: string): TimeOfDayPreference | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("morning")) return "morning";
  if (lower.includes("afternoon")) return "afternoon";
  if (lower.includes("evening") || lower.includes("after work")) return "evening";
  return undefined;
}

function parseAfterTime(text: string): string | undefined {
  const match = text.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return undefined;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour < 8) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseIntentType(text: string): SchedulingIntent["intent"] {
  const lower = text.toLowerCase();
  if (/\bcancel\b|\bcan'?t make it\b|\bneed to cancel\b/.test(lower)) return "cancel";
  if (/\breschedule\b|\bmove\b|\bchange.*(time|date|appointment)\b/.test(lower)) {
    return "reschedule";
  }
  if (/\bconfirm\b|\byes\b/.test(lower)) return "confirm";
  if (/\bavailable\b|\bavailability\b|\bdo you have\b|\banything\b/.test(lower)) {
    return "availability_request";
  }
  return "availability_request";
}

/** Deterministic fallback when AI is unavailable. */
export function parseSchedulingIntentFallback(
  text: string,
  context?: {
    appointmentTypes?: Array<{ id: string; name: string }>;
    timezone?: string;
  },
): SchedulingIntent {
  const lower = text.toLowerCase();
  const intent = parseIntentType(text);
  const requestedDate = parseDayReference(text);
  const timeOfDay = parseTimeOfDay(text);
  const preferredTimeStart = parseAfterTime(text);

  let appointmentTypeName: string | undefined;
  let appointmentTypeId: string | undefined;
  if (context?.appointmentTypes?.length) {
    for (const t of context.appointmentTypes) {
      if (lower.includes(t.name.toLowerCase())) {
        appointmentTypeName = t.name;
        appointmentTypeId = t.id;
        break;
      }
    }
    if (!appointmentTypeId && context.appointmentTypes.length === 1) {
      appointmentTypeId = context.appointmentTypes[0].id;
      appointmentTypeName = context.appointmentTypes[0].name;
    }
  }

  const missingFields: string[] = [];
  if (!appointmentTypeId && context?.appointmentTypes && context.appointmentTypes.length > 1) {
    missingFields.push("appointment_type");
  }
  if (!requestedDate && intent !== "cancel") {
    missingFields.push("date");
  }

  return {
    intent,
    appointmentTypeId,
    appointmentTypeName,
    requestedDate,
    timeOfDay,
    preferredTimeStart,
    timezone: context?.timezone,
    originalText: text,
    confidence: 0.4,
    missingFields: missingFields.length ? missingFields : undefined,
    followUpQuestion:
      missingFields.includes("appointment_type")
        ? "What would you like to book?"
        : missingFields.includes("date")
          ? "What day works best for you?"
          : undefined,
  };
}
