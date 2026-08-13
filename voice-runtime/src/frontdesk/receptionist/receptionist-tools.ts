import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { takeStructuredMessage } from "@/lib/voice/domain-actions/take-structured-message";
import { resolveReceptionistCallbackPhone } from "@/lib/voice/receptionist/field-validation";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import {
  missingReceptionistFields,
  type ReceptionistCollectionPurpose,
} from "@/lib/voice/receptionist/field-collection-scope";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { buildFrontDeskBookingTools } from "../booking-tools";
import type { FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";
import { ReceptionistFieldCollectionTask, speakReceptionistCollectionLine } from "./field-collection-task";
import { buildReceptionistCollectionToolResult } from "./field-collection-lifecycle";
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
          throw new llm.ToolError(
            "Ask one brief question for the message reason. Do not call collect_caller_fields.",
          );
        }

        const name =
          args.caller_name?.trim() ||
          ud.receptionistFields?.name ||
          "";
        if (!name) {
          throw new llm.ToolError(
            "Ask for the caller's full name only. Do not call collect_caller_fields or explain the process.",
          );
        }

        const phone = resolveReceptionistCallbackPhone({
          collectedPhone: ud.receptionistFields?.phone,
          preferredCallback: args.preferred_callback,
          callerE164: ud.callerE164,
        });
        if (!phone) {
          throw new llm.ToolError(
            "Ask for a callback phone number only. Do not call collect_caller_fields.",
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
        return (
          "Message recorded. Tell the caller someone from the team will follow up once — " +
          "do not repeat the callback script. If they change their mind and want to book, " +
          "proceed with booking using collect_caller_fields with purpose booking."
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
          throw new llm.ToolError("No phone number available to send a text.");
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
        if (result.ok === false || result.error) {
          throw new llm.ToolError(String(result.error || "SMS failed"));
        }
        return "Text message sent.";
      });
    },
  });
}

function buildCollectCallerFieldsTool(snapshot: ReceptionistCompiledSnapshot) {
  const manifest = snapshot.fieldManifest;
  if (!manifest.length) return null;

  return llm.tool({
    name: "collect_caller_fields",
    description:
      "Collect missing required caller profile fields (name, phone) for service or booking. " +
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
        if (ud.receptionistMessageTaken && purpose !== "booking") {
          return (
            "A callback message was already recorded. If the caller wants to book instead, " +
            "call collect_caller_fields with purpose booking. Otherwise continue their request."
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

  const collectTool = buildCollectCallerFieldsTool(snapshot);
  if (collectTool && capabilitySet.has("collect_info")) push(collectTool);

  return { toolDefs, slotsMap: booking.slotsMap };
}
