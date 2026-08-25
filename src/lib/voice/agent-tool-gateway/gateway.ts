import type { AgentToolContext } from "./types";
import { AgentToolError, failResult, translateError } from "./errors";
import { toLegacyVoiceShape } from "./envelope";
import { normalizeBookInput } from "./normalize";
import { runBookAppointment } from "./booking-workflow";
import { runCheckAvailabilityTool } from "./availability-workflow";
import {
  runCancelAppointment,
  runFindAppointments,
  runHoldAppointmentSlot,
  runReleaseAppointmentHold,
  runRescheduleAppointment,
  runSendSms,
} from "./scheduling-workflows";
import { DOMAIN_TOOL_ALIASES } from "@/lib/voice/workflow-engine/tool-publish";

/** Canonical agent tool names + legacy aliases. */
const TOOL_ALIASES: Record<string, string> = {
  check_availability: "calendar_availability",
  calendar_availability: "calendar_availability",
  book_appointment: "book_appointment",
  confirm_booking: "book_appointment",
  get_booking_requirements: "get_workflow_requirements",
  ...DOMAIN_TOOL_ALIASES,
};

const GATEWAY_TOOLS = new Set([
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "release_appointment_hold",
  "find_appointments",
  "reschedule_appointment",
  "cancel_appointment",
  "send_sms",
]);

export async function executeAgentTool(input: {
  toolType: string;
  context: AgentToolContext;
  raw: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const canonical = TOOL_ALIASES[input.toolType] || input.toolType;
  const ctx = input.context;

  try {
    switch (canonical) {
      case "calendar_availability": {
        const result = await runCheckAvailabilityTool(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "book_appointment": {
        const result = await runBookAppointment(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "hold_appointment_slot": {
        const result = await runHoldAppointmentSlot(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "release_appointment_hold": {
        const result = await runReleaseAppointmentHold(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "find_appointments": {
        const result = await runFindAppointments(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "reschedule_appointment": {
        const result = await runRescheduleAppointment(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "cancel_appointment": {
        const result = await runCancelAppointment(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "send_sms": {
        const result = await runSendSms(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      default:
        throw new AgentToolError(
          "INVALID_INPUT",
          `Tool ${input.toolType} is not routed through the agent gateway`,
        );
    }
  } catch (err) {
    const ate = err instanceof AgentToolError ? err : translateError(err);
    const operationId =
      normalizeBookInput(input.raw, { callId: ctx.callId }).operation_id ||
      (input.raw.operation_id ? String(input.raw.operation_id) : null);
    return toLegacyVoiceShape(failResult(ate, operationId));
  }
}

export function isGatewayRoutedTool(toolType: string): boolean {
  const canonical = TOOL_ALIASES[toolType] || toolType;
  return GATEWAY_TOOLS.has(canonical);
}
