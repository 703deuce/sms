import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { takeStructuredMessage } from "@/lib/voice/domain-actions/take-structured-message";
import {
  resolveReceptionistCallbackPhone,
  validateReceptionistFieldValue,
} from "@/lib/voice/receptionist/field-validation";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import {
  missingReceptionistFields,
  type ReceptionistCollectionPurpose,
} from "@/lib/voice/receptionist/field-collection-scope";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { buildFrontDeskBookingTools } from "../booking-tools";
import { isBookingOperationActive } from "../booking-operation";
import type { FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";
import {
  formatToolFeedbackForModel,
  formatGatewayResultForModel,
  toolFeedbackMissingCallerField,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";
import { ReceptionistFieldCollectionTask, speakReceptionistCollectionLine } from "./field-collection-task";
import { buildReceptionistCollectionToolResult } from "./field-collection-lifecycle";
import { runBookingIntakeTask } from "../booking-intake-task";
import { buildBookingIntakeToolResult } from "../booking-intake-lifecycle";
import { markParentResumed } from "../../task-transition-instrumentation";
import { resyncOpenAIRealtimeAgentChatCtx } from "../../realtime-openai-chat-context";

function caps(snapshot: ReceptionistCompiledSnapshot): Set<string> {
  return new Set(snapshot.capabilities);
}

function actionAllowed(
  snapshot: ReceptionistCompiledSnapshot,
  permKey: keyof NonNullable<ReceptionistCompiledSnapshot["actionPermissions"]>,
  capability?: string,
): boolean {
  const capabilitySet = caps(snapshot);
  if (capability && !capabilitySet.has(capability)) return false;
  const perms = snapshot.actionPermissions;
  if (perms && permKey in perms && perms[permKey] === false) return false;
  return true;
}

function backfillReceptionistFields(
  session: AgentSession<FrontDeskUserData>,
  manifest: ReceptionistCompiledSnapshot["fieldManifest"],
): void {
  const ud = session.userData;
  if (!ud.receptionistFields) ud.receptionistFields = {};
  ud.receptionistFields = applyReceptionistFieldBackfill({
    chatCtx: session.chatCtx,
    manifest,
    receptionistFields: ud.receptionistFields,
  });
}

function buildRecordReceptionistFieldTool(snapshot: ReceptionistCompiledSnapshot) {
  const manifest = snapshot.fieldManifest;
  if (!manifest.length) return null;
  const fieldIds = manifest.map((f) => f.id);
  if (!fieldIds.length) return null;

  return llm.tool({
    name: "record_receptionist_field",
    description:
      "Persist caller information they already stated (name, phone, email, address, reason, etc.). " +
      "Call immediately when the caller volunteers a value — do not wait for collect_caller_fields. " +
      "Use during booking after schedule_appointment reports a missing field.",
    parameters: z.object({
      field_id: z
        .enum(fieldIds as [string, ...string[]])
        .describe(`Field id from manifest: ${fieldIds.join(", ")}`),
      value: z.string().describe("The value the caller provided"),
    }),
    execute: async ({ field_id, value }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "record_receptionist_field", { field_id, value }, async () => {
        const field = manifest.find((f) => f.id === field_id);
        if (!field) return `Unknown field ${field_id}.`;
        const trimmed = value?.trim() || "";
        if (!trimmed) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "record_receptionist_field",
              fieldId: field_id,
              fieldLabel: field.label,
            }),
          );
        }
        try {
          const normalized = validateReceptionistFieldValue(field, trimmed);
          if (!ud.receptionistFields) ud.receptionistFields = {};
          ud.receptionistFields[field_id] = normalized;
          const pendingSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
          const bookingTail = pendingSlot
            ? ` Then call schedule_appointment with slot_id ${pendingSlot}.`
            : "";
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              `${field.label} saved.${bookingTail}`,
              { tool: "record_receptionist_field" },
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : `Please provide your ${field.label}.`;
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "record_receptionist_field",
              recovery_class: "INVALID_INFORMATION",
              reason: "validation_failed",
              field_id,
              field_label: field.label,
              next_action: "collect_field_then_retry",
              guidance: message,
            }),
          );
        }
      });
    },
  });
}

function buildTakeMessageTool(snapshot: ReceptionistCompiledSnapshot) {
  return llm.tool({
    name: "take_message",
    description:
      "Record a callback message for staff. Use when the caller wants someone to follow up. " +
      "Put the caller's issue in reason — use what they already said, do not ask again. " +
      "Do NOT call collect_caller_fields before this tool. " +
      "Callback number may come from caller ID when they confirm.",
    parameters: z.object({
      reason: z.string().describe("Main message or reason for callback"),
      caller_name: z.string().optional(),
      urgency: z.enum(["low", "normal", "high"]).optional(),
      preferred_callback: z.string().optional(),
      notes: z.string().optional(),
    }),
    execute: async (args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "take_message", args, async () => {
        backfillReceptionistFields(session, snapshot.fieldManifest);

        const reason =
          args.reason?.trim() ||
          ud.receptionistFields?.reason?.trim() ||
          "";
        if (!reason) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "take_message",
              fieldId: "reason",
              fieldLabel: "message reason",
              hint: "Ask one brief question for the message reason. Do not call collect_caller_fields.",
            }),
          );
        }

        const name =
          args.caller_name?.trim() ||
          ud.receptionistFields?.name ||
          "";
        if (!name) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "take_message",
              fieldId: "name",
              fieldLabel: "full name",
              hint: "Ask for the caller's full name only. Do not call collect_caller_fields.",
            }),
          );
        }

        const phone = resolveReceptionistCallbackPhone({
          collectedPhone: ud.receptionistFields?.phone,
          preferredCallback: args.preferred_callback,
          callerE164: ud.callerE164,
        });
        if (!phone) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "take_message",
              fieldId: "phone",
              fieldLabel: "callback phone number",
              hint: "Ask for a callback phone number only. Do not call collect_caller_fields.",
            }),
          );
        }

        ud.receptionistFields = {
          ...(ud.receptionistFields || {}),
          name,
          phone,
          reason,
        };
        ud.receptionistMessageTaken = true;

        await takeStructuredMessage({
          workspaceId: ud.workspaceId,
          callId: ud.callId,
          reason,
          caller_name: name,
          phone,
          urgency: args.urgency || "normal",
          preferred_callback: args.preferred_callback?.trim() || undefined,
          notes: args.notes,
        });
        return formatToolFeedbackForModel(
          toolFeedbackSuccess(
            "Message recorded. Tell the caller someone will follow up once — do not repeat the callback script.",
            { tool: "take_message" },
          ),
        );
      });
    },
  });
}

function buildSendSmsTool() {
  return llm.tool({
    name: "send_sms",
    description:
      "Send a text message to the caller's phone. Use when they ask for a text confirmation " +
      "or follow-up. Do not say you cannot send texts — use this tool.",
    parameters: z.object({
      message: z.string().describe("SMS body to send"),
      phone: z.string().optional().describe("Destination phone if not caller ANI"),
    }),
    execute: async ({ message, phone }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      if (ud.bookingConfirmationSmsSent && !message?.trim()) {
        return (
          "A booking confirmation text was already sent to the caller's phone. " +
          "Tell them to check their messages — it may take a moment to arrive."
        );
      }
      return withLiveKitToolTelemetry(ud, "send_sms", { message }, async () => {
        const to = resolveReceptionistCallbackPhone({
          collectedPhone: phone?.trim() || ud.receptionistFields?.phone,
          callerE164: ud.callerE164,
        });
        if (!to) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "send_sms",
              fieldId: "phone",
              fieldLabel: "phone number",
              hint: "Ask for the phone number to text — do not say SMS failed.",
            }),
          );
        }
        const result = await executeAgentTool({
          toolType: "send_sms",
          context: {
            workspaceId: ud.workspaceId,
            agentId: ud.agentId,
            callId: ud.callId,
          },
          raw: { message, phone: to },
        });
        return formatGatewayResultForModel(result, "send_sms");
      });
    },
  });
}

function buildCollectBookingRequirementsTool(snapshot: ReceptionistCompiledSnapshot) {
  const manifest = snapshot.fieldManifest;
  if (!manifest.length) return null;

  return llm.tool({
    name: "collect_booking_requirements",
    description:
      "Collect all missing booking requirements (name, phone, email, address, custom fields, preferred time). " +
      "Use when schedule_appointment reports missing information or before booking when profile fields are incomplete. " +
      "Caller may provide multiple details in one answer — the intake task persists each immediately. " +
      "Do NOT use collect_caller_fields for booking.",
    parameters: z.object({
      reason: z.string().optional().describe("Why booking intake is needed"),
    }),
    execute: async (args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "collect_booking_requirements", args, async () => {
        if (isBookingOperationActive(ud)) {
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              "Booking is already in progress. Tell the caller you're finishing the appointment. " +
                "If they ask whether it worked, use check_booking_status.",
              { tool: "collect_booking_requirements", next_action: "check_booking_status" },
            ),
          );
        }

        backfillReceptionistFields(session, manifest);
        const missing = missingReceptionistFields(manifest, ud.receptionistFields, "booking");
        if (!missing.length) {
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              "All booking requirements are already satisfied. Call schedule_appointment with the chosen slot_id.",
              { tool: "collect_booking_requirements" },
            ),
          );
        }

        const firstMissing = missing[0];
        if (firstMissing?.question?.trim()) {
          ud.receptionistFieldCollectionPrefaceSpoken = true;
          await speakReceptionistCollectionLine(session, firstMissing.question);
        }

        const result = await runBookingIntakeTask(session);
        ud.receptionistFieldCollectionPrefaceSpoken = false;
        await resyncOpenAIRealtimeAgentChatCtx(session.currentAgent);
        markParentResumed({
          callId: ud.callId,
          taskId: "booking_intake",
          taskType: "BookingIntakeTask",
          parentTaskType: "GenericReceptionistAgent",
          collectionComplete: result.complete,
        });
        ud.activeTaskInstrumentation = {
          taskId: "parent_after_booking_intake",
          taskType: "GenericReceptionistAgent",
        };
        return buildBookingIntakeToolResult(ud, result);
      });
    },
  });
}

async function runBookingPurposeFieldCollection(
  session: AgentSession<FrontDeskUserData>,
  manifest: ReceptionistCompiledSnapshot["fieldManifest"],
): Promise<string> {
  const ud = session.userData;
  backfillReceptionistFields(session, manifest);
  const missing = missingReceptionistFields(manifest, ud.receptionistFields, "booking");
  if (!missing.length) {
    return "Caller information is already complete. Continue with booking.";
  }
  const firstMissing = missing[0];
  if (firstMissing?.question?.trim()) {
    ud.receptionistFieldCollectionPrefaceSpoken = true;
    await speakReceptionistCollectionLine(session, firstMissing.question);
  }
  const result = await runBookingIntakeTask(session);
  ud.receptionistFieldCollectionPrefaceSpoken = false;
  await resyncOpenAIRealtimeAgentChatCtx(session.currentAgent);
  markParentResumed({
    callId: ud.callId,
    taskId: "booking_intake",
    taskType: "BookingIntakeTask",
    parentTaskType: "GenericReceptionistAgent",
    collectionComplete: result.complete,
  });
  ud.activeTaskInstrumentation = {
    taskId: "parent_after_booking_intake",
    taskType: "GenericReceptionistAgent",
  };
  return buildBookingIntakeToolResult(ud, result);
}

function buildCollectCallerFieldsTool(snapshot: ReceptionistCompiledSnapshot) {
  const manifest = snapshot.fieldManifest;
  if (!manifest.length) return null;

  return llm.tool({
    name: "collect_caller_fields",
    description:
      "Collect missing required caller profile fields (name, phone) for service requests. " +
      "Do NOT use for booking — use collect_booking_requirements instead. " +
      "Do NOT use when the caller is leaving a message — use take_message instead. " +
      "Do NOT use when the caller already gave the issue; backfill handles that.",
    parameters: z.object({
      reason: z.string().optional().describe("Why collection is needed"),
      purpose: z
        .enum(["message", "service", "booking", "general"])
        .optional()
        .describe("message = never use; service = field collection for a service request; booking = scheduling"),
    }),
    execute: async (args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "collect_caller_fields", args, async () => {
        const purpose = (args.purpose as ReceptionistCollectionPurpose | undefined) || "service";
        if (purpose === "message") {
          return "Use take_message for callback requests — do not run field collection.";
        }
        if (purpose === "booking" && isBookingOperationActive(ud)) {
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              "Booking is already in progress. Tell the caller you're finishing the appointment. " +
                "If they ask whether it worked, use check_booking_status.",
              { tool: "collect_caller_fields", next_action: "check_booking_status" },
            ),
          );
        }
        if (purpose === "booking" && ud.pendingSlotId) {
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "collect_caller_fields",
              recovery_class: "OPERATION_IN_PROGRESS",
              reason: "booking_slot_pending",
              next_action: "collect_booking_requirements",
              guidance:
                `A time slot is already chosen (${ud.pendingSlotId}). Use collect_booking_requirements for any missing fields, ` +
                "then call schedule_appointment with that slot_id.",
            }),
          );
        }
        if (purpose === "booking") {
          return runBookingPurposeFieldCollection(session, manifest);
        }
        if (ud.receptionistMessageTaken && purpose !== "booking") {
          return (
            "A callback message was already recorded. If the caller wants to book instead, " +
            "call collect_booking_requirements. Otherwise continue their request."
          );
        }

        backfillReceptionistFields(session, manifest);
        const missing = missingReceptionistFields(
          manifest,
          ud.receptionistFields,
          purpose,
        );
        if (!missing.length) {
          return "Caller information is already complete. Continue with take_message, booking, or answering.";
        }
        const firstMissing = missing[0];
        if (firstMissing?.question?.trim()) {
          ud.receptionistFieldCollectionPrefaceSpoken = true;
          await speakReceptionistCollectionLine(session, firstMissing.question);
        }
        const result = await new ReceptionistFieldCollectionTask(session, missing).run();
        ud.receptionistFieldCollectionPrefaceSpoken = false;
        await resyncOpenAIRealtimeAgentChatCtx(session.currentAgent);
        markParentResumed({
          callId: ud.callId,
          taskId: "receptionist_field_collection",
          taskType: "ReceptionistFieldCollectionTask",
          parentTaskType: "GenericReceptionistAgent",
          collectionComplete: result.complete,
        });
        ud.activeTaskInstrumentation = {
          taskId: "parent_after_collection",
          taskType: "GenericReceptionistAgent",
        };
        return buildReceptionistCollectionToolResult(ud, result);
      });
    },
  });
}

function toolName(tool: unknown): string | undefined {
  if (tool && typeof tool === "object" && "name" in tool) {
    return String((tool as { name?: string }).name || "");
  }
  return undefined;
}

export function buildReceptionistTools(input: {
  snapshot: ReceptionistCompiledSnapshot;
  timezone: string;
}) {
  const snapshot = input.snapshot;
  const capabilitySet = caps(snapshot);

  const booking = buildFrontDeskBookingTools({
    timezone: input.timezone,
    includeBooking: capabilitySet.has("book_appointments"),
  });

  const names = new Set<string>();
  const toolDefs: unknown[] = [];

  const push = (tool: unknown) => {
    const name = toolName(tool);
    if (name && names.has(name)) return;
    if (name) names.add(name);
    toolDefs.push(tool);
  };

  for (const tool of booking.toolDefs) {
    const name = toolName(tool);
    if (name === "take_message" || name === "send_sms" || name === "collect_caller_fields") {
      continue;
    }
    if (!actionAllowed(snapshot, "bookAppointments", "book_appointments") && name?.includes("appointment")) {
      continue;
    }
    if (name === "cancel_appointment" && !actionAllowed(snapshot, "cancelAppointments", "book_appointments")) {
      continue;
    }
    if (name === "reschedule_appointment" && !actionAllowed(snapshot, "rescheduleAppointments", "book_appointments")) {
      continue;
    }
    if (!snapshot.capabilities.includes("answer_questions") && name === "get_business_answer") continue;
    if (!actionAllowed(snapshot, "transferCalls", "transfer_calls") && name === "transfer_to_human") continue;
    push(tool);
  }

  if (actionAllowed(snapshot, "takeMessages", "take_messages")) push(buildTakeMessageTool(snapshot));
  if (actionAllowed(snapshot, "sendSms", "send_text")) push(buildSendSmsTool());

  const recordFieldTool = buildRecordReceptionistFieldTool(snapshot);
  if (recordFieldTool && capabilitySet.has("collect_info")) push(recordFieldTool);

  const collectBookingTool = buildCollectBookingRequirementsTool(snapshot);
  if (collectBookingTool && capabilitySet.has("collect_info") && capabilitySet.has("book_appointments")) {
    push(collectBookingTool);
  }

  const collectTool = buildCollectCallerFieldsTool(snapshot);
  if (collectTool && capabilitySet.has("collect_info")) push(collectTool);

  return { toolDefs, slotsMap: booking.slotsMap };
}
