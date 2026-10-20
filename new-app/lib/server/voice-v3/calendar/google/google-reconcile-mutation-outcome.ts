import "server-only";

import type { VoiceV3AgentConfig } from "../../config/agent-config";
import type { ExistingAppointment } from "../appointment-management-types";
import { resolveVoiceV3GoogleCalendar } from "./resolve-voice-v3-google-calendar";
import { validateGoogleAppointmentBeforeMutation } from "./validate-google-appointment";

export type CancelReconcileVerdict = "CANCELLED" | "STILL_EXISTS" | "UNKNOWN";

export async function reconcileGoogleCancelOutcome(input: {
  appointment: ExistingAppointment;
  config: VoiceV3AgentConfig;
}): Promise<CancelReconcileVerdict> {
  const resolved = await resolveVoiceV3GoogleCalendar(input.config);
  if (!resolved.ok) return "UNKNOWN";
  const validation = await validateGoogleAppointmentBeforeMutation({
    appointment: input.appointment,
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });
  if (!validation.ok) {
    if (validation.reason === "not_found" || validation.reason === "cancelled") {
      return "CANCELLED";
    }
    return "UNKNOWN";
  }
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
  const validation = await validateGoogleAppointmentBeforeMutation({
    appointment: input.appointment,
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });
  if (!validation.ok) {
    if (validation.reason === "not_found" || validation.reason === "cancelled") {
      return "EVENT_MISSING";
    }
    return "UNEXPECTED_STATE";
  }

  const eventStart = new Date(validation.startUtc).getTime();
  const eventEnd = new Date(validation.endUtc).getTime();
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
