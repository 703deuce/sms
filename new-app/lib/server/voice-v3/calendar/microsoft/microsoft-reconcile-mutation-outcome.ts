import "server-only";

import type { VoiceV3AgentConfig } from "../../config/agent-config";
import type { ExistingAppointment } from "../appointment-management-types";
import { fetchMicrosoftEventById } from "./microsoft-get-event";
import { resolveVoiceV3MicrosoftCalendar } from "./resolve-voice-v3-microsoft-calendar";

export type CancelReconcileVerdict = "CANCELLED" | "STILL_EXISTS" | "UNKNOWN";

export async function reconcileMicrosoftCancelOutcome(input: {
  appointment: ExistingAppointment;
  config: VoiceV3AgentConfig;
}): Promise<CancelReconcileVerdict> {
  const resolved = await resolveVoiceV3MicrosoftCalendar(input.config);
  if (!resolved.ok) return "UNKNOWN";
  const snap = await fetchMicrosoftEventById({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    providerEventId: input.appointment.providerEventId,
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

export async function reconcileMicrosoftRescheduleOutcome(input: {
  appointment: ExistingAppointment;
  requestedStartUtc: string;
  requestedEndUtc: string;
  config: VoiceV3AgentConfig;
}): Promise<RescheduleReconcileVerdict> {
  const resolved = await resolveVoiceV3MicrosoftCalendar(input.config);
  if (!resolved.ok) return "UNEXPECTED_STATE";
  const snap = await fetchMicrosoftEventById({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    providerEventId: input.appointment.providerEventId,
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
