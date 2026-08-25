import { SEMANTIC_TOOL_NAMES, type SemanticToolName } from "./semantic-tool-surface";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions";

export class SemanticToolResolutionError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
  ) {
    super(message);
    this.name = "SemanticToolResolutionError";
  }
}

/** Map semantic LLM tool invocations to internal domain tool names + normalized args. */
export function resolveSemanticToolInvocation(
  toolName: string,
  args: Record<string, unknown> = {},
  ctx?: LiveKitCallContext,
): { internalTool: string; args: Record<string, unknown> } {
  switch (toolName as SemanticToolName) {
    case "capture_caller_information":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.capture_caller_information,
        args: {
          extracted_fields: args.extracted_fields,
          utterance: args.utterance,
          intent: args.intent,
        },
      };
    case "choose_appointment_time":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.choose_appointment_time,
        args: {
          selection: args.selection || args.spoken_label,
          slot_iso: args.slot_id || args.slot_iso,
        },
      };
    case "confirm_action": {
      const intent =
        (args.intent ? String(args.intent) : null) ||
        ctx?.session.runtime.session_runtime?.callerIntent ||
        null;
      const appointmentId =
        (args.appointment_id ? String(args.appointment_id) : null) ||
        ctx?.session.runtime.session_runtime?.foundAppointmentId?.trim() ||
        "";

      if (intent === "reschedule" && appointmentId) {
        const held = ctx?.session.heldSlot || ctx?.session.selectedSlot;
        return {
          internalTool: "reschedule_appointment",
          args: {
            appointment_id: appointmentId,
            new_starts_at: args.slot_id || args.new_starts_at || held,
            confirmed: args.confirmed === true,
          },
        };
      }

      if (intent === "cancel" && appointmentId) {
        return {
          internalTool: "cancel_appointment",
          args: {
            appointment_id: appointmentId,
            confirmed: args.confirmed === true,
            reason: args.reason,
          },
        };
      }

      if (intent === "cancel" || intent === "reschedule") {
        throw new SemanticToolResolutionError(
          intent === "cancel"
            ? "I need to find your appointment before I can cancel it."
            : "I need to find your appointment before I can reschedule it.",
          "MISSING_APPOINTMENT",
        );
      }

      return {
        internalTool: SEMANTIC_TOOL_NAMES.confirm_action,
        args: { confirmed: args.confirmed === true },
      };
    }
    case "answer_business_question":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.answer_business_question,
        args: { topic: args.topic || args.question },
      };
    case "detect_caller_intent":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.detect_caller_intent,
        args: { utterance: args.utterance },
      };
    case "take_message":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.take_message,
        args: {
          message: args.message,
          caller_name: args.caller_name,
        },
      };
    case "transfer_to_human":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.transfer_to_human,
        args: { reason: args.reason },
      };
    case "end_call":
      return {
        internalTool: SEMANTIC_TOOL_NAMES.end_call,
        args: { reason: args.reason },
      };
    case "modify_appointment": {
      const action = String(args.action || "find");
      if (action === "reschedule") {
        const appointmentId =
          (args.appointment_id ? String(args.appointment_id) : null) ||
          ctx?.session.runtime.session_runtime?.foundAppointmentId?.trim() ||
          "";
        if (!appointmentId) {
          throw new SemanticToolResolutionError(
            "I need to find your appointment before I can reschedule it.",
            "MISSING_APPOINTMENT",
          );
        }
        return {
          internalTool: "reschedule_appointment",
          args: {
            appointment_id: appointmentId,
            new_starts_at: args.new_starts_at || args.slot_id,
            confirmed: args.confirmed,
          },
        };
      }
      if (action === "cancel") {
        const appointmentId =
          (args.appointment_id ? String(args.appointment_id) : null) ||
          ctx?.session.runtime.session_runtime?.foundAppointmentId?.trim() ||
          "";
        if (!appointmentId) {
          throw new SemanticToolResolutionError(
            "I need to find your appointment before I can cancel it.",
            "MISSING_APPOINTMENT",
          );
        }
        return {
          internalTool: "cancel_appointment",
          args: {
            appointment_id: appointmentId,
            confirmed: args.confirmed,
            reason: args.reason,
          },
        };
      }
      return {
        internalTool: "find_appointments",
        args: { phone: args.phone },
      };
    }
    default:
      return { internalTool: toolName, args };
  }
}

export function isSemanticToolName(toolName: string): boolean {
  return toolName in SEMANTIC_TOOL_NAMES || toolName === "modify_appointment";
}
