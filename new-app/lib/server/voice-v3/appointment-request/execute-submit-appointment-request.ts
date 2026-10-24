import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import { toolOk, voiceToolError, type VoiceToolResult } from "../tools/types";
import { getMissingFieldsForOperation } from "../intake-objective/operation-requirements";
import { persistVoiceV3AppointmentRequest } from "./persist-appointment-request";
import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";
import { notifyVoiceV3AppointmentBooked } from "../notifications/notify-appointment-booked";

export type SubmitAppointmentRequestArgs = {
  preferred_time?: string | null;
  notes?: string | null;
};

export async function executeSubmitAppointmentRequest(input: {
  workspaceId: string;
  agentId: string | null;
  config: VoiceV3AgentConfig;
  context: VoiceV3CallContext;
  args: SubmitAppointmentRequestArgs;
}): Promise<{ result: VoiceToolResult; nextContext: VoiceV3CallContext }> {
  const { config, args } = input;
  let ctx = input.context;

  if (config.scheduling?.bookingStrategy !== "REQUEST_ONLY") {
    return {
      result: voiceToolError(
        "BOOKING_STRATEGY_MISMATCH",
        "submit_appointment_request is only available for Request-only booking mode.",
        {},
        "not_allowed",
      ),
      nextContext: ctx,
    };
  }

  const missing = getMissingFieldsForOperation("book_appointment", config, ctx);
  if (missing.length) {
    return {
      result: toolOk("needs_information", { status: "needs_information", missingFields: missing }),
      nextContext: ctx,
    };
  }

  const phone =
    normalizePhoneE164(ctx.intake.values.phone?.value) ||
    normalizePhoneE164(ctx.telephony.inboundCallerE164) ||
    null;
  if (!phone) {
    return {
      result: toolOk("needs_information", {
        status: "needs_information",
        missingFields: ["phone"],
      }),
      nextContext: ctx,
    };
  }

  const name = ctx.intake.values.name?.value?.trim() || null;
  const reason =
    ctx.intake.values.service_reason?.value?.trim() ||
    ctx.intake.values.service?.value?.trim() ||
    args.notes?.trim() ||
    null;
  const preferredTime = args.preferred_time?.trim() || null;
  const configVersion = config.configVersion?.trim() || "unknown";
  const idempotencyKey = `v3apptreq:${ctx.callId}:${phone}:${configVersion}`;

  const snapshot: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx.intake.values)) {
    if (v?.value?.trim()) snapshot[k] = v.value;
  }

  const persist = await persistVoiceV3AppointmentRequest({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: ctx.callId,
    liveSessionId: ctx.liveSessionId,
    callerName: name,
    callerPhoneE164: phone,
    preferredTime,
    reason,
    customFieldsSnapshot: snapshot,
    idempotencyKey,
    businessE164: config.telephony.phoneNumberE164,
    phoneNumberId: config.telephony.phoneNumberId,
  });

  if (!persist.ok) {
    return {
      result: voiceToolError(
        "APPOINTMENT_REQUEST_FAILED",
        persist.message,
        { status: "failed" },
        "failed",
        persist.retryable,
      ),
      nextContext: ctx,
    };
  }

  ctx = {
    ...ctx,
    updatedAt: new Date().toISOString(),
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    runtime: { version: ctx.runtime.version + 1 },
  };

  void notifyVoiceV3AppointmentBooked({
    config,
    workspaceId: input.workspaceId,
    callId: ctx.callId,
    appointmentId: persist.requestId,
    callerName: name,
    callerPhone: phone,
    bookedTimeLabel: preferredTime || "Appointment request",
    serviceLabel: reason || "Requested appointment",
  }).catch((err) =>
    console.error("VOICE_V3_APPOINTMENT_REQUEST_NOTIFY_FAILED", {
      callId: ctx.callId,
      message: err instanceof Error ? err.message : String(err),
    }),
  );

  return {
    result: toolOk("appointment_requested", {
      status: "appointment_requested",
      requestId: persist.requestId,
    }),
    nextContext: ctx,
  };
}
