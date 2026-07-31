import { getPrisma } from "@/lib/db";
import { emitAutomationEvent } from "@/lib/automations/events";

const VOICE_EVENT_MAP: Record<string, string> = {
  "call.voicemail_detected": "call_voicemail_detected",
  "call.transferred": "call_transferred",
  "call.transfer_failed": "call_transfer_failed",
  "call.qualified": "call_qualified",
  "call.unqualified": "call_unqualified",
  "call.appointment_booked": "call_appointment_booked",
  "call.follow_up_required": "call_follow_up_required",
  "call.opt_out_requested": "call_opt_out_requested",
};

export async function emitVoiceAutomationEvents(call: {
  id: string;
  workspaceId: string;
  contactId: string | null;
  outcome?: string | null;
  voicemailDetected: boolean;
  transferred: boolean;
  appointmentBooked: boolean;
  leadScore?: number | null;
}) {
  if (!call.contactId) return;

  if (call.voicemailDetected) {
    await emitAutomationEvent(call.workspaceId, "call.voicemail_detected", call.contactId, {
      callId: call.id,
    });
  }
  if (call.transferred) {
    await emitAutomationEvent(call.workspaceId, "call.transferred", call.contactId, {
      callId: call.id,
    });
  }
  if (call.appointmentBooked) {
    await emitAutomationEvent(call.workspaceId, "call.appointment_booked", call.contactId, {
      callId: call.id,
    });
  }
  if (call.leadScore != null && call.leadScore >= 40) {
    await emitAutomationEvent(call.workspaceId, "call.qualified", call.contactId, {
      callId: call.id,
      leadScore: call.leadScore,
    });
  } else if (call.leadScore != null) {
    await emitAutomationEvent(call.workspaceId, "call.unqualified", call.contactId, {
      callId: call.id,
      leadScore: call.leadScore,
    });
  }
}

export function registerVoiceAutomationTriggers() {
  // Extended in automations/events.ts
  return VOICE_EVENT_MAP;
}
