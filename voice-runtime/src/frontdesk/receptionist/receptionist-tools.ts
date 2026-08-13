import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AgentSession } from "@livekit/agents";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { takeStructuredMessage } from "@/lib/voice/domain-actions/take-structured-message";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { buildFrontDeskBookingTools } from "../booking-tools";
import type { FrontDeskUserData } from "../userdata";
import { withLiveKitToolTelemetry } from "../../livekit-tool-telemetry";
import { ReceptionistFieldCollectionTask } from "./field-collection-task";
import {
  TOOL_RESULT_COLLECT_ACTIVE_SILENT,
  TOOL_RESULT_COLLECT_COMPLETE_SILENT,
} from "./field-collection-lifecycle";

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

function buildTakeMessageTool() {
  return llm.tool({
    name: "take_message",
    description:
      "Take a structured message for staff when the caller needs a callback or does not want to book.",
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
        const name =
          args.caller_name?.trim() ||
          ud.receptionistFields?.name ||
          "";
        const phone = ud.receptionistFields?.phone || ud.callerE164 || "";
        await takeStructuredMessage({
          workspaceId: ud.workspaceId,
          callId: ud.callId,
          reason: args.reason,
          caller_name: name,
          phone,
          urgency: args.urgency || "normal",
          preferred_callback: args.preferred_callback,
          notes: args.notes,
        });
        return "Message recorded. Tell the caller someone from the team will follow up.";
      });
    },
  });
}

function buildSendSmsTool() {
  return llm.tool({
    name: "send_sms",
    description: "Send a text message to the caller after they confirm.",
    parameters: z.object({
      message: z.string().describe("SMS body to send"),
      phone: z.string().optional().describe("Destination phone if not caller ANI"),
    }),
    execute: async ({ message, phone }, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "send_sms", { message }, async () => {
        const to = phone?.trim() || ud.receptionistFields?.phone || ud.callerE164 || "";
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
      "Collect required caller information (name, phone, reason, etc.) when not yet captured.",
    parameters: z.object({
      reason: z.string().optional().describe("Why collection is needed"),
    }),
    execute: async (_args, opts) => {
      const session = opts.ctx.session as AgentSession<FrontDeskUserData>;
      const ud = session.userData;
      return withLiveKitToolTelemetry(ud, "collect_caller_fields", {}, async () => {
        const missing = manifest.filter((f) => !ud.receptionistFields?.[f.id]?.trim());
        if (!missing.length) {
          return "Caller information is already complete.";
        }
        const result = await new ReceptionistFieldCollectionTask(session, missing).run();
        return result.complete
          ? TOOL_RESULT_COLLECT_COMPLETE_SILENT
          : TOOL_RESULT_COLLECT_ACTIVE_SILENT;
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

  if (actionAllowed(snapshot, "takeMessages", "take_messages")) push(buildTakeMessageTool());
  if (actionAllowed(snapshot, "sendSms", "send_text")) push(buildSendSmsTool());

  const collectTool = buildCollectCallerFieldsTool(snapshot);
  if (collectTool && capabilitySet.has("collect_info")) push(collectTool);

  return { toolDefs, slotsMap: booking.slotsMap };
}
