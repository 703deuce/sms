import "server-only";

import type { VoiceV3AgentConfig } from "../../config/agent-config";
import type { ExistingAppointment } from "../appointment-management-types";
import { fetchGoogleEventById } from "./google-get-event";
import { resolveVoiceV3GoogleCalendar } from "./resolve-voice-v3-google-calendar";

export type CancelReconcileVerdict = "CANCELLED" | "STILL_EXISTS" | "UNKNOWN";

export async function reconcileGoogleCancelOutcome(input: {
  appointment: ExistingAppointment;
  config: VoiceV3AgentConfig;
}): Promise<CancelReconcileVerdict> {
  const resolved = await resolveVoiceV3GoogleCalendar(input.config);
  if (!resolved.ok) return "UNKNOWN";
  const snap = await fetchGoogleEventById({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    providerEventId: input.appointment.providerEventId,
    providerCalendarId: input.appointment.providerCalendarId,
  });
  if (!snap.ok) {
    if (snap.reason === "not_found") return "CANCELLED";
    return "UNKNOWN";
  }
  if (snap.event.isCancelled) return "CANCELLED";
  return "STILL_EXISTS";
}

export type RescheduleReconcileVerdict =
  | "NEW_TIME"
  | "ORIGINAL_TIME"
  | "EVENT_MISSING"
  | "UNEXPECTED_STATE";

export async function reconcileGoogleRescheduleOutcome(input: {
  appointment: ExistingAppointment;
  requestedStartUtc: string;
  requestedEndUtc: string;
  config: VoiceV3AgentConfig;
}): Promise<RescheduleReconcileVerdict> {
  const resolved = await resolveVoiceV3GoogleCalendar(input.config);
  if (!resolved.ok) return "UNEXPECTED_STATE";
  const snap = await fetchGoogleEventById({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    providerEventId: input.appointment.providerEventId,
    providerCalendarId: input.appointment.providerCalendarId,
  });
  if (!snap.ok) {
    if (snap.reason === "not_found") return "EVENT_MISSING";
    return "UNEXPECTED_STATE";
  }
  if (snap.event.isCancelled) return "EVENT_MISSING";

  const eventStart = new Date(snap.event.startUtc).getTime();
  const eventEnd = new Date(snap.event.endUtc).getTime();
  const reqStart = new Date(input.requestedStartUtc).getTime();
  const reqEnd = new Date(input.requestedEndUtc).getTime();
  if (eventStart === reqStart && eventEnd === reqEnd) return "NEW_TIME";

  const origStart = new Date(input.appointment.startUtc).getTime();
  const origEnd = new Date(input.appointment.endUtc).getTime();
  if (eventStart === origStart && eventEnd === origEnd) {
    return "ORIGINAL_TIME";
  }
  return "UNEXPECTED_STATE";
}
