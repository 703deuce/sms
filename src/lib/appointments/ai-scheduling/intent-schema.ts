/**
 * AI scheduling intent schema — shared by public booking and Conversations.
 */

export type SchedulingIntentType =
  | "availability_request"
  | "new_booking"
  | "reschedule"
  | "cancel"
  | "confirm";

export type TimeOfDayPreference = "morning" | "afternoon" | "evening";

export type SchedulingIntent = {
  intent: SchedulingIntentType;
  appointmentTypeId?: string;
  appointmentTypeName?: string;
  requestedDate?: string;
  requestedDateStart?: string;
  requestedDateEnd?: string;
  preferredTime?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  timeOfDay?: TimeOfDayPreference;
  durationMinutes?: number;
  timezone?: string;
  staffPreference?: string;
  locationPreference?: string;
  recurring?: {
    frequency: "weekly" | "biweekly" | "monthly";
    occurrences?: number;
    endDate?: string;
  };
  groupSeats?: number;
  originalText: string;
  confidence: number;
  missingFields?: string[];
  followUpQuestion?: string;
};

export const SCHEDULING_INTENT_JSON_SCHEMA = `{
  "intent": "availability_request|new_booking|reschedule|cancel|confirm",
  "appointmentTypeId": "string optional",
  "appointmentTypeName": "string optional",
  "requestedDate": "YYYY-MM-DD optional",
  "requestedDateStart": "YYYY-MM-DD optional",
  "requestedDateEnd": "YYYY-MM-DD optional",
  "preferredTime": "HH:MM optional",
  "preferredTimeStart": "HH:MM optional",
  "preferredTimeEnd": "HH:MM optional",
  "timeOfDay": "morning|afternoon|evening optional",
  "durationMinutes": "number optional",
  "timezone": "IANA timezone optional",
  "staffPreference": "string optional",
  "locationPreference": "string optional",
  "confidence": "0-1 number",
  "missingFields": ["array of field names"],
  "followUpQuestion": "string optional"
}`;

export function validateSchedulingIntent(raw: unknown): SchedulingIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const intent = String(o.intent || "");
  const validIntents: SchedulingIntentType[] = [
    "availability_request",
    "new_booking",
    "reschedule",
    "cancel",
    "confirm",
  ];
  if (!validIntents.includes(intent as SchedulingIntentType)) return null;

  const confidence = Number(o.confidence);
  return {
    intent: intent as SchedulingIntentType,
    appointmentTypeId: typeof o.appointmentTypeId === "string" ? o.appointmentTypeId : undefined,
    appointmentTypeName:
      typeof o.appointmentTypeName === "string" ? o.appointmentTypeName : undefined,
    requestedDate: typeof o.requestedDate === "string" ? o.requestedDate : undefined,
    requestedDateStart:
      typeof o.requestedDateStart === "string" ? o.requestedDateStart : undefined,
    requestedDateEnd: typeof o.requestedDateEnd === "string" ? o.requestedDateEnd : undefined,
    preferredTime: typeof o.preferredTime === "string" ? o.preferredTime : undefined,
    preferredTimeStart:
      typeof o.preferredTimeStart === "string" ? o.preferredTimeStart : undefined,
    preferredTimeEnd: typeof o.preferredTimeEnd === "string" ? o.preferredTimeEnd : undefined,
    timeOfDay:
      o.timeOfDay === "morning" || o.timeOfDay === "afternoon" || o.timeOfDay === "evening"
        ? o.timeOfDay
        : undefined,
    durationMinutes:
      typeof o.durationMinutes === "number" ? o.durationMinutes : undefined,
    timezone: typeof o.timezone === "string" ? o.timezone : undefined,
    staffPreference: typeof o.staffPreference === "string" ? o.staffPreference : undefined,
    locationPreference:
      typeof o.locationPreference === "string" ? o.locationPreference : undefined,
    originalText: typeof o.originalText === "string" ? o.originalText : "",
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    missingFields: Array.isArray(o.missingFields)
      ? o.missingFields.filter((f): f is string => typeof f === "string")
      : undefined,
    followUpQuestion:
      typeof o.followUpQuestion === "string" ? o.followUpQuestion : undefined,
  };
}
