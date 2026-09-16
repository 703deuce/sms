import "server-only";

import { getPrisma } from "@/lib/db";
import {
  getValidAccessToken,
  hasOAuthTokens,
  cancelOrDeleteMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { resolveSessionKey } from "../intake/load-call-context";
import { markAppointmentActionStatus, resolveStoredAppointmentRef, selectAppointmentRef } from "./ref-store";
import type { CancelAppointmentResult } from "./types";

export async function executeVoiceV2CancelAppointment(
  raw: Record<string, unknown>,
  workspaceId: string,
  options?: { agentId?: string | null },
): Promise<CancelAppointmentResult> {
  const appointmentRefId = String(raw.appointment_ref_id || raw.appointmentRefId || "").trim();
  const toolInvocationId = String(raw.tool_invocation_id || raw.toolInvocationId || "").trim();
  const callId = String(raw.call_id || raw.callId || "").trim();
  const confirmed = raw.caller_confirmed === true || raw.caller_confirmed === "true";

  if (!appointmentRefId) {
    return { status: "INVALID_REF", error: "appointment_ref_id_required" };
  }

  const agentId = options?.agentId?.trim() || String(raw.agent_id || "").trim();
  if (agentId) {
    const { voiceV2AppointmentChangeCapabilities } = await import("./capabilities");
    const caps = await voiceV2AppointmentChangeCapabilities({ workspaceId, agentId });
    if (!caps.cancel) return { status: "NOT_ALLOWED", error: "cancel_not_enabled" };
  }

  const sessionKey = callId
    ? resolveSessionKey({ callControlId: callId, conversationId: null })
    : null;
  if (!sessionKey) return { status: "INVALID_REF", error: "session_required" };

  selectAppointmentRef(sessionKey, appointmentRefId);
  const ref = resolveStoredAppointmentRef(sessionKey, appointmentRefId);
  if (!ref) return { status: "INVALID_REF", error: "appointment_ref_not_found" };
  if (ref.provider !== "microsoft") {
    return { status: "ERROR", error: "provider_not_supported_yet" };
  }
  if (ref.eventKind === "seriesMaster") {
    return { status: "ERROR", error: "cannot_cancel_series_master" };
  }

  if (!confirmed) {
    return {
      status: "ERROR",
      error: "caller_confirmation_required",
    };
  }

  const idempotencyKey = toolInvocationId
    ? `v2cancel:${workspaceId}:${toolInvocationId}`
    : `v2cancel:${workspaceId}:${appointmentRefId}`;

  const prisma = getPrisma();
  const existing = await prisma.voiceV2BookingIdempotency.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.resultJson) {
    markAppointmentActionStatus(sessionKey, "CANCEL_CONFIRMED");
    const cached = existing.resultJson as Record<string, unknown>;
    return {
      status: "CANCEL_CONFIRMED",
      appointment_ref_id: appointmentRefId,
      spoken_confirmation: String(
        cached.spoken_confirmation || "Your appointment has been canceled.",
      ),
    };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn || conn.status !== "connected") {
    return { status: "ERROR", error: "microsoft_connection_not_connected" };
  }
  const config = (conn.config || {}) as CalendarConfig;
  if (!hasOAuthTokens(config)) return { status: "ERROR", error: "microsoft_oauth_tokens_missing" };

  const token = await getValidAccessToken(conn.id, "microsoft", config);
  if (!token) return { status: "ERROR", error: "microsoft_token_unavailable" };

  const hasAttendees = false;
  try {
    await cancelOrDeleteMicrosoftEvent(
      token,
      ref.providerEventId,
      { hasAttendees, comment: "Canceled per caller request" },
      { connectionId: conn.id, config },
    );
  } catch (err) {
    return {
      status: "ERROR",
      error: err instanceof Error ? err.message : "microsoft_cancel_failed",
    };
  }

  const spokenConfirmation = `Okay, ${ref.spokenLabel} has been canceled.`;

  if (ref.voiceAppointmentId) {
    void prisma.voiceAppointment
      .update({
        where: { id: ref.voiceAppointmentId },
        data: { status: "cancelled" },
      })
      .catch(() => undefined);
  }

  try {
    await prisma.voiceV2BookingIdempotency.create({
      data: {
        idempotencyKey,
        workspaceId,
        offerSetId: "cancel",
        slotId: appointmentRefId,
        microsoftEventId: ref.providerEventId,
        voiceAppointmentId: ref.voiceAppointmentId ?? null,
        resultJson: {
          spoken_confirmation: spokenConfirmation,
          appointment_ref_id: appointmentRefId,
        } as object,
      },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;
  }

  markAppointmentActionStatus(sessionKey, "CANCEL_CONFIRMED");

  return {
    status: "CANCEL_CONFIRMED",
    appointment_ref_id: appointmentRefId,
    spoken_confirmation: spokenConfirmation,
  };
}
