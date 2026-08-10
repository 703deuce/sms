import { llm } from "@livekit/agents";
import { z } from "zod";
import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import {
  domainCancelAppointment,
  domainConfirmBooking,
  domainDetectCallerIntent,
  domainEndCall,
  domainFindAppointments,
  domainGetBusinessAnswer,
  domainRequestHuman,
  domainRescheduleAppointment,
  domainSelectSlot,
  domainSubmitCallerInformation,
  domainTakeMessage,
  type DomainActionResult,
} from "@/lib/voice/domain-actions";
import { buildSlotsPayload } from "@/lib/voice/domain-actions/tool-results";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { compileSemanticToolNamesForSession } from "@/lib/voice/agent-runtime/semantic-tool-surface";
import { taskForWorkflowState } from "@/lib/voice/domain-actions/task-guard";
import type { AmyToolOptions } from "./amy-tool-types";

function slotIdSchema(callContext: LiveKitCallContext) {
  const slots = buildSlotsPayload(callContext.session);
  if (!slots.length) {
    return z.string().describe("Slot id from the offered appointment times");
  }
  const ids = slots.map((s) => s.slotId);
  return z.enum(ids as [string, ...string[]]).describe("One of the offered slot ids");
}

export function buildAmySemanticToolList(input: {
  callContext: LiveKitCallContext;
  wrapToolExecute: (
    toolName: string,
    opts: AmyToolOptions,
    execute: (ctx: LiveKitCallContext) => Promise<DomainActionResult>,
    options?: { fillerMessage?: string; refresh?: boolean },
  ) => Promise<string>;
}): { tools: llm.ToolContextEntry[]; taskId: string } {
  const { callContext } = input;
  const taskId = taskForWorkflowState(callContext.session.currentState);
  const { envelope, canonical, allowedToolNames } = compileToolsForCallContext(callContext);
  const callerIntent = callContext.session.runtime.session_runtime?.callerIntent || null;
  const semanticAllowed =
    allowedToolNames.size > 0
      ? allowedToolNames
      : compileSemanticToolNamesForSession({
          canonical,
          envelopeToolNames: envelope.toolNames,
          session: callContext.session,
          callerIntent,
        });

  const wrap =
    (
      semanticName: string,
      internalName: string,
      execute: (ctx: LiveKitCallContext) => Promise<DomainActionResult>,
      options?: { fillerMessage?: string; refresh?: boolean },
    ) =>
    async (opts: AmyToolOptions) =>
      input.wrapToolExecute(internalName, opts, execute, options);

  const tools: llm.ToolContextEntry[] = [];

  if (semanticAllowed.has("capture_caller_information")) {
    tools.push(
      llm.tool({
        name: "capture_caller_information",
        description:
          "Save structured information the caller just provided (name, email, phone, address, service issue, or other configured fields). The runtime persists values and advances automatically.",
        parameters: z.object({
          extracted_fields: z
            .record(z.string(), z.string())
            .optional()
            .describe("Field id or alias → value"),
          utterance: z.string().optional().describe("Raw caller utterance when fields are unclear"),
          intent: z
            .string()
            .optional()
            .describe("book, reschedule, cancel, or emergency if newly understood"),
        }),
        execute: async ({ extracted_fields, utterance, intent }, opts: AmyToolOptions) =>
          wrap(
            "capture_caller_information",
            "submit_caller_information",
            async (ctx) =>
              domainSubmitCallerInformation({
                ctx,
                extractedFields: extracted_fields,
                utterance,
                intent,
              }),
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("choose_appointment_time")) {
    tools.push(
      llm.tool({
        name: "choose_appointment_time",
        description:
          "Record which offered appointment time the caller chose. Use the slot id from the active capability context.",
        parameters: z.object({
          slot_id: slotIdSchema(callContext),
          selection: z
            .string()
            .optional()
            .describe("How the caller described their choice, e.g. the first one"),
        }),
        execute: async ({ slot_id, selection }, opts: AmyToolOptions) =>
          wrap(
            "choose_appointment_time",
            "select_slot",
            async (ctx) =>
              domainSelectSlot({
                ctx,
                utterance: selection || slot_id,
                slotIso: slot_id,
              }),
            { fillerMessage: "One moment." },
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("confirm_action")) {
    tools.push(
      llm.tool({
        name: "confirm_action",
        description:
          "Commit the held appointment after the caller explicitly confirms. Only call when they clearly say yes.",
        parameters: z.object({
          confirmed: z.boolean().describe("True when caller explicitly confirms"),
        }),
        execute: async ({ confirmed }, opts: AmyToolOptions) => {
          const intent = callContext.session.runtime.session_runtime?.callerIntent;
          const appointmentId =
            callContext.session.runtime.session_runtime?.foundAppointmentId?.trim() || "";

          if (intent === "reschedule" && appointmentId) {
            const held = callContext.session.heldSlot || callContext.session.selectedSlot;
            return wrap(
              "confirm_action",
              "reschedule_appointment",
              async (ctx) =>
                domainRescheduleAppointment({
                  ctx,
                  appointmentId,
                  newStartsAt: String(held || ""),
                  confirmed,
                }),
              { fillerMessage: "One moment." },
            )(opts);
          }

          if (intent === "cancel" && appointmentId) {
            return wrap(
              "confirm_action",
              "cancel_appointment",
              async (ctx) =>
                domainCancelAppointment({
                  ctx,
                  appointmentId,
                  confirmed,
                }),
              { fillerMessage: "One moment." },
            )(opts);
          }

          return wrap(
            "confirm_action",
            "confirm_booking",
            async (ctx) => domainConfirmBooking({ ctx, confirmed }),
            { fillerMessage: "One moment." },
          )(opts);
        },
      }),
    );
  }

  if (semanticAllowed.has("detect_caller_intent")) {
    tools.push(
      llm.tool({
        name: "detect_caller_intent",
        description:
          "Detect whether the caller wants to book, reschedule, cancel, or has an emergency.",
        parameters: z.object({
          utterance: z.string().optional(),
        }),
        execute: async ({ utterance }, opts: AmyToolOptions) =>
          wrap("detect_caller_intent", "detect_caller_intent", async (ctx) =>
            domainDetectCallerIntent({ ctx, utterance }),
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("answer_business_question")) {
    tools.push(
      llm.tool({
        name: "answer_business_question",
        description: "Answer configured business questions such as pricing or hours.",
        parameters: z.object({
          topic: z.string().describe("What the caller asked about"),
        }),
        execute: async ({ topic }, opts: AmyToolOptions) =>
          wrap("answer_business_question", "get_business_answer", async (ctx) =>
            domainGetBusinessAnswer({ ctx, topic }),
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("modify_appointment")) {
    tools.push(
      llm.tool({
        name: "modify_appointment",
        description:
          "Find, reschedule, or cancel an existing appointment. Use action=find first when needed.",
        parameters: z.object({
          action: z
            .enum(["find", "reschedule", "cancel"])
            .describe("find existing appointment, reschedule, or cancel"),
          appointment_id: z.string().optional(),
          slot_id: z.string().optional().describe("New slot id when rescheduling"),
          confirmed: z.boolean().optional(),
          reason: z.string().optional(),
          phone: z.string().optional(),
        }),
        execute: async (args, opts: AmyToolOptions) => {
          if (args.action === "find") {
            return wrap("modify_appointment", "find_appointments", async (ctx) =>
              domainFindAppointments({ ctx, phone: args.phone }),
            )(opts);
          }
          if (args.action === "reschedule") {
            return wrap("modify_appointment", "reschedule_appointment", async (ctx) =>
              domainRescheduleAppointment({
                ctx,
                appointmentId: String(args.appointment_id || ""),
                newStartsAt: String(args.slot_id || ""),
                confirmed: args.confirmed,
              }),
            )(opts);
          }
          return wrap("modify_appointment", "cancel_appointment", async (ctx) =>
            domainCancelAppointment({
              ctx,
              appointmentId: String(args.appointment_id || ""),
              confirmed: args.confirmed,
              reason: args.reason,
            }),
          )(opts);
        },
      }),
    );
  }

  if (semanticAllowed.has("take_message")) {
    tools.push(
      llm.tool({
        name: "take_message",
        description: "Save a message for the business when the caller cannot book or needs follow-up.",
        parameters: z.object({
          message: z.string(),
          caller_name: z.string().optional(),
        }),
        execute: async ({ message, caller_name }, opts: AmyToolOptions) =>
          wrap("take_message", "take_message", async (ctx) =>
            domainTakeMessage({ ctx, message, callerName: caller_name }),
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("transfer_to_human")) {
    tools.push(
      llm.tool({
        name: "transfer_to_human",
        description: "Transfer to a human after the caller confirms they want to speak with someone.",
        parameters: z.object({
          reason: z.string().optional(),
        }),
        execute: async ({ reason }, opts: AmyToolOptions) =>
          wrap(
            "transfer_to_human",
            "request_human",
            async (ctx) => domainRequestHuman({ ctx, reason }),
            { refresh: false },
          )(opts),
      }),
    );
  }

  if (semanticAllowed.has("end_call")) {
    tools.push(
      llm.tool({
        name: "end_call",
        description: "End the call when the conversation is complete.",
        parameters: z.object({
          reason: z.string().optional(),
        }),
        execute: async ({ reason }, opts: AmyToolOptions) =>
          wrap(
            "end_call",
            "end_call",
            async (ctx) => domainEndCall({ ctx, reason }),
            { refresh: false },
          )(opts),
      }),
    );
  }

  return { tools, taskId };
}
