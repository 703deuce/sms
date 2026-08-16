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
import { buildReceptionistConversationRecap, formatReceptionistFieldsSummary } from "@/lib/voice/receptionist/conversation-recap";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { buildFrontDeskBookingTools } from "../booking-tools";
import { validateBookingNotesField } from "../booking-field-validation";
import { afterReceptionistFieldPersisted } from "../booking-field-coherence";
import { formatBookingEmailSavedFeedback, persistConfirmedBookingEmail } from "../booking-email-state";
import { type FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";
import {
  formatToolFeedbackForModel,
  formatGatewayResultForModel,
  toolFeedbackMissingCallerField,
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";
import { ensureReceptionistWorkflow, firstMissingFieldForPurpose } from "./workflow-engine";
import { wrapReceptionistToolDefs } from "./workflow-tool-wrapper";

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
    authoritativeFieldIds: ud.authoritativeFieldIds,
  });
}

function buildRecordCurrentFieldTool(snapshot: ReceptionistCompiledSnapshot) {
  const manifest = snapshot.fieldManifest;
  if (!manifest.length) return null;
  const fieldIds = manifest.map((f) => f.id);
  if (!fieldIds.length) return null;

  return llm.tool({
    name: "record_current_field",
    description:
      "Save the caller's answer for the active collection field. " +
      "The runtime decides which field is active during booking or message collection — " +
      "call this immediately when the caller answers. Do not use collect_booking_requirements or collect_caller_fields.",
    parameters: z.object({
      value: z.string().describe("The value the caller provided for the active field"),
      field_id: z
        .string()
        .optional()
        .describe(
          "Optional — only when the caller volunteers a different field than the active one",
        ),
    }),
    execute: async ({ value, field_id }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      const wf = ensureReceptionistWorkflow(ud);
      const purpose = wf.collectionPurpose || "booking";
      const targetId =
        field_id?.trim() ||
        wf.activeFieldId ||
        firstMissingFieldForPurpose(ud, purpose)?.id ||
        "";
      if (!targetId) {
        return formatToolFeedbackForModel(
          toolFeedbackSuccess("All required fields are already saved.", {
            tool: "record_current_field",
            next_action: "continue_conversation",
          }),
        );
      }

      return withLiveKitToolTelemetry(ud, "record_current_field", { field_id: targetId, value }, async () => {
        const field = manifest.find((f) => f.id === targetId);
        if (!field) return `Unknown field ${targetId}.`;
        const trimmed = value?.trim() || "";
        if (!trimmed) {
          return formatToolFeedbackForModel(
            toolFeedbackMissingCallerField({
              tool: "record_current_field",
              fieldId: targetId,
              fieldLabel: field.label,
            }),
          );
        }
        try {
          if (targetId === "email" || field.type === "email") {
            const persisted = persistConfirmedBookingEmail(ud, trimmed);
            return formatBookingEmailSavedFeedback(ud, "record_current_field", persisted);
          }

          const notesCheck = validateBookingNotesField(targetId, trimmed);
          if (!notesCheck.ok) {
            return formatToolFeedbackForModel(
              toolFeedbackRecoverable({
                tool: "record_current_field",
                recovery_class: "INVALID_INFORMATION",
                reason: "needs_confirmation",
                field_id: targetId,
                field_label: field.label,
                next_action: "collect_field_then_retry",
                guidance: notesCheck.message,
              }),
            );
          }

          const normalized = validateReceptionistFieldValue(field, notesCheck.normalized);
          if (!ud.receptionistFields) ud.receptionistFields = {};
          const previous = ud.receptionistFields[targetId];
          ud.receptionistFields[targetId] = normalized;
          afterReceptionistFieldPersisted(ud, targetId, normalized, previous);
          if (!ud.authoritativeFieldIds) ud.authoritativeFieldIds = [];
          if (!ud.authoritativeFieldIds.includes(targetId)) {
            ud.authoritativeFieldIds.push(targetId);
          }

          return formatToolFeedbackForModel(
            toolFeedbackSuccess(`${field.label} saved.`, {
              tool: "record_current_field",
              field_id: targetId,
              field_label: field.label,
              next_action: "collect_field_then_retry",
              runtime_handled_retry: true,
              guidance: `${field.label} saved. Runtime will ask for the next missing field or advance booking.`,
              context: {
                saved_value: normalized,
                fields_summary: formatReceptionistFieldsSummary(ud.receptionistFields),
              },
            }),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : `Please provide your ${field.label}.`;
          return formatToolFeedbackForModel(
            toolFeedbackRecoverable({
              tool: "record_current_field",
              recovery_class: "INVALID_INFORMATION",
              reason: "validation_failed",
              field_id: targetId,
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
      "For email during booking, use this tool (field_id email) — do not also call record_booking_email.",
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
          if (field_id === "email" || field.type === "email") {
            const persisted = persistConfirmedBookingEmail(ud, trimmed);
            return formatBookingEmailSavedFeedback(ud, "record_receptionist_field", persisted);
          }

          const notesCheck = validateBookingNotesField(field_id, trimmed);
          if (!notesCheck.ok) {
            return formatToolFeedbackForModel(
              toolFeedbackRecoverable({
                tool: "record_receptionist_field",
                recovery_class: "INVALID_INFORMATION",
                reason: "needs_confirmation",
                field_id,
                field_label: field.label,
                next_action: "collect_field_then_retry",
                guidance: notesCheck.message,
              }),
            );
          }

          const normalized = validateReceptionistFieldValue(field, notesCheck.normalized);
          if (!ud.receptionistFields) ud.receptionistFields = {};
          const previous = ud.receptionistFields[field_id];
          ud.receptionistFields[field_id] = normalized;
          const coherence = afterReceptionistFieldPersisted(ud, field_id, normalized, previous);
          const pendingSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
          const bookingTail = pendingSlot
            ? ` Then call schedule_appointment with slot_id ${pendingSlot}.`
            : coherence.slotInvalidated
              ? " Time preference changed — call list_available_slots and let the caller pick a new time."
              : "";
          const conversationRecap = buildReceptionistConversationRecap({
            chatCtx: session.chatCtx,
            receptionistFields: ud.receptionistFields,
            fieldManifest: manifest,
            purpose: "booking",
          });
          return formatToolFeedbackForModel(
            toolFeedbackSuccess(
              `${field.label} saved.${bookingTail}`,
              {
                tool: "record_receptionist_field",
                next_action: pendingSlot
                  ? "schedule_appointment_retry"
                  : coherence.slotInvalidated
                    ? "list_slots_then_retry"
                    : "continue_conversation",
                guidance: `${field.label} saved.${bookingTail}`,
                context: {
                  fields_summary: formatReceptionistFieldsSummary(ud.receptionistFields),
                  conversation_recap: conversationRecap,
                },
              },
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
      "Do NOT call record_current_field before this tool when message fields are incomplete — runtime collects first. " +
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
            {
              tool: "take_message",
              next_action: "continue_conversation",
              guidance:
                "Confirm the message was taken once. Ask if there is anything else — one question only.",
            },
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

  const recordCurrentFieldTool = buildRecordCurrentFieldTool(snapshot);
  if (recordCurrentFieldTool && capabilitySet.has("collect_info")) push(recordCurrentFieldTool);

  const recordFieldTool = buildRecordReceptionistFieldTool(snapshot);
  if (recordFieldTool && capabilitySet.has("collect_info")) push(recordFieldTool);

  const wrapped = wrapReceptionistToolDefs(toolDefs, { prepareWorkflow: true });

  return {
    toolDefs: wrapped,
    slotsMap: booking.slotsMap,
    toolNames: [...names],
  };
}
