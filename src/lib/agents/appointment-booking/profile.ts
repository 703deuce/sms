/**
 * Extract AppointmentAgentProfile + BookingPolicy from live VoiceAgent/wizard config.
 * Does not invent a parallel booking engine — reads what already powers Telnyx.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type {
  AppointmentAgentProfile,
  BookingPolicy,
} from "@/lib/agents/appointment-booking/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseNoticeMinutes(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw || "").toLowerCase();
  const hours = s.match(/(\d+)\s*hour/);
  if (hours) return Number(hours[1]) * 60;
  const mins = s.match(/(\d+)\s*min/);
  if (mins) return Number(mins[1]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

function parseAdvanceDays(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw || "").toLowerCase();
  const days = s.match(/(\d+)\s*day/);
  if (days) return Number(days[1]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

function bookingSectionConfig(config: VoiceAgentConfig): Record<string, unknown> {
  const sections = config.conversationFlow?.sections || [];
  const booking = sections.find((s) => s.type === "booking" || s.id === "booking");
  return asRecord(booking?.config);
}

export function extractBookingPolicyFromConfig(
  draftConfig: unknown,
): BookingPolicy {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const tools = Array.isArray(config.enabledBuiltinTools)
    ? config.enabledBuiltinTools.map(String)
    : [];
  const messaging = asRecord(config.messaging);
  const bookingCfg = bookingSectionConfig(config);
  const behavior = asRecord(bookingCfg.bookingBehavior);
  const collect = asRecord(bookingCfg.collectFields);
  const appointmentTypes = Array.isArray(bookingCfg.appointmentTypes)
    ? bookingCfg.appointmentTypes
    : [];

  const canBook =
    tools.includes("book_appointment") ||
    Boolean(appointmentTypes.length) ||
    tools.includes("calendar_availability");
  const canReschedule = tools.includes("reschedule_appointment");
  const canCancel = tools.includes("cancel_appointment");

  const allowedServices = appointmentTypes
    .map((t) => {
      const row = asRecord(t);
      if (row.enabled === false) return "";
      return String(row.id || row.name || "").trim();
    })
    .filter(Boolean);

  const firstType = asRecord(appointmentTypes[0]);
  const duration = Number(firstType.durationMin || firstType.durationMinutes || 60);
  const minimumNoticeMinutes = parseNoticeMinutes(
    firstType.minNotice || behavior.minimumNoticeMinutes || 120,
  );
  const maximumAdvanceDays = parseAdvanceDays(
    firstType.maxDaysAhead || behavior.maximumAdvanceDays || 30,
  );

  const permission = String(
    firstType.bookingPermission || behavior.bookingPermission || "book_directly",
  );
  const bookingMode =
    permission === "suggest_then_confirm"
      ? "staff_confirmation_required"
      : permission === "send_booking_link" || permission === "waitlist"
        ? "request_only"
        : "exact_slot";

  const requiredFields = Array.isArray(firstType.requiredFields)
    ? firstType.requiredFields.map(String)
    : [];

  return {
    canBook,
    canReschedule,
    canCancel,
    requireCallerName:
      collect.name !== false &&
      (requiredFields.length === 0 ||
        requiredFields.some((f) => /name/i.test(f))),
    requirePhoneNumber:
      collect.phone !== false &&
      (requiredFields.length === 0 ||
        requiredFields.some((f) => /phone/i.test(f))),
    requireEmail:
      collect.email === true || requiredFields.some((f) => /email/i.test(f)),
    requireServiceAddress:
      collect.serviceAddress === true ||
      collect.address === true ||
      requiredFields.some((f) => /address/i.test(f)),
    appointmentDurationMinutes: Number.isFinite(duration) ? duration : 60,
    minimumNoticeMinutes,
    maximumAdvanceDays,
    allowedServices,
    allowedLocations: [],
    requireFinalConfirmation: behavior.requireFinalConfirmation !== false,
    sendSmsConfirmation:
      messaging.smsConfirmations === true || tools.includes("send_sms"),
    bookingMode,
    sameDayCutoff:
      typeof behavior.sameDayCutoff === "string" ? behavior.sameDayCutoff : null,
  };
}

export function buildAppointmentAgentProfile(input: {
  agentId: string;
  draftConfig: unknown;
  calendarConnectionIds: string[];
  timezone?: string | null;
}): AppointmentAgentProfile {
  const policy = extractBookingPolicyFromConfig(input.draftConfig);
  const config = parseVoiceAgentConfig(input.draftConfig || {});
  const transfers = asRecord(config.transfers);
  const callHandling = asRecord(config.callHandling);
  const dyn = asRecord(config.dynamicVariables);
  const voice = config.voiceLanguage || {};

  return {
    agentId: input.agentId,
    locationIds: policy.allowedLocations,
    serviceIds: policy.allowedServices,
    calendarConnectionIds: input.calendarConnectionIds,
    bookingMode: policy.bookingMode,
    minimumNoticeMinutes: policy.minimumNoticeMinutes,
    maximumAdvanceDays: policy.maximumAdvanceDays,
    requiredFields: {
      name: policy.requireCallerName,
      phone: policy.requirePhoneNumber,
      email: policy.requireEmail,
      serviceAddress: policy.requireServiceAddress,
      service: true,
    },
    canBook: policy.canBook,
    canReschedule: policy.canReschedule,
    canCancel: policy.canCancel,
    requireFinalConfirmation: policy.requireFinalConfirmation,
    sendConfirmationSms: policy.sendSmsConfirmation,
    transferPolicySummary: transfers.enabled
      ? `Transfers enabled${transfers.destinationName ? ` → ${transfers.destinationName}` : ""}`
      : "Transfers disabled",
    fallbackPolicySummary: String(
      callHandling.fallbackAction || transfers.fallback || "take_message",
    ),
    voiceSummary: String(voice.voiceId || voice.voiceProvider || "default"),
    timezone: String(
      input.timezone ||
        dyn.timezone ||
        dyn.business_timezone ||
        "America/New_York",
    ),
  };
}

export function summarizeConfigForOwner(config: VoiceAgentConfig): string[] {
  const lines: string[] = [];
  const greeting = config.instructions?.system;
  if (greeting) lines.push(`Instructions: ${String(greeting).slice(0, 160)}`);
  const tz = asRecord(config.dynamicVariables).timezone;
  if (tz) lines.push(`Timezone: ${tz}`);
  const tools = Array.isArray(config.enabledBuiltinTools)
    ? config.enabledBuiltinTools
    : [];
  if (tools.length) lines.push(`Tools: ${tools.slice(0, 12).join(", ")}`);
  return lines;
}
