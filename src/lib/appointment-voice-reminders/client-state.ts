import type { AppointmentVoiceCallMetadata } from "./types";

export type AppointmentVoiceClientState = {
  kind: "appointment_voice_reminder";
  voiceCallId: string;
  workspaceId: string;
  awaiting?: "dtmf" | "post_action";
};

export function encodeAppointmentVoiceClientState(
  state: AppointmentVoiceClientState,
): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function decodeAppointmentVoiceClientState(
  raw?: string | null,
): AppointmentVoiceClientState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as AppointmentVoiceClientState;
    if (parsed?.kind === "appointment_voice_reminder" && parsed.voiceCallId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function parseVoiceCallMetadata(raw: unknown): AppointmentVoiceCallMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as AppointmentVoiceCallMetadata;
  if (m.kind !== "appointment_voice_reminder" || !m.appointmentId) return null;
  return m;
}
