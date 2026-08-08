import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import {
  buildAmyLiveKitPermanentPrompt,
  buildAmyTaskContextBlock,
} from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import {
  domainCheckAvailability,
  domainConfirmBooking,
  domainRecordField,
  domainSelectSlot,
  taskContextPayload,
  taskForWorkflowState,
  toolsForTask,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import type { AmyProcessUserData } from "./metadata";

function requireCallContext(opts: llm.ToolOptions): LiveKitCallContext {
  const callContext = (opts.ctx.userData as AmyProcessUserData).callContext;
  if (!callContext) throw new llm.ToolError("Call context not initialized");
  return callContext;
}

function stashContext(opts: llm.ToolOptions, ctx: LiveKitCallContext) {
  (opts.ctx.userData as AmyProcessUserData).callContext = ctx;
}

function formatToolResult(result: {
  ok: boolean;
  speak: string;
  workflow_state?: string;
  data?: Record<string, unknown>;
  error_code?: string;
}): string {
  return JSON.stringify({
    ok: result.ok,
    speak: result.speak,
    workflow_state: result.workflow_state,
    data: result.data || {},
    error_code: result.error_code,
  });
}

async function withSlowToolFiller<T>(
  opts: llm.ToolOptions,
  startMessage: string,
  fn: () => Promise<T>,
): Promise<T> {
  return opts.ctx.filler(
    (step) => (step === 0 ? startMessage : "Still working on that."),
    { delay: 0, interval: 4000, maxSteps: 2 },
    fn,
  );
}

export function buildAmyToolList(callContext: LiveKitCallContext) {
  const taskId = taskForWorkflowState(callContext.session.currentState);
  const allowed = new Set(toolsForTask(taskId));
  const tools: llm.ToolContextEntry[] = [];

  if (allowed.has("record_field")) {
    tools.push(
      llm.tool({
        name: "record_field",
        description: "Save the caller's answer for the currently active required field.",
        parameters: z.object({
          value: z.string().describe("The caller's answer for the active field"),
        }),
        execute: async ({ value }, opts) => {
          const ctx = requireCallContext(opts);
          const result = await withSlowToolFiller(opts, "Got it, one moment.", async () =>
            domainRecordField({ ctx, value }),
          );
          stashContext(opts, ctx);
          return formatToolResult(result);
        },
      }),
    );
  }

  if (allowed.has("check_availability")) {
    tools.push(
      llm.tool({
        name: "check_availability",
        description: "Check real calendar availability for the caller's preferred time window.",
        parameters: z.object({
          spoken: z.string().describe("Caller time preference, e.g. tomorrow afternoon"),
        }),
        execute: async ({ spoken }, opts) => {
          const ctx = requireCallContext(opts);
          const result = await withSlowToolFiller(opts, "Sure, let me check.", async () =>
            domainCheckAvailability({ ctx, spoken }),
          );
          stashContext(opts, ctx);
          return formatToolResult(result);
        },
      }),
    );
  }

  if (allowed.has("select_slot")) {
    tools.push(
      llm.tool({
        name: "select_slot",
        description: "Select one of the offered appointment slots and place a hold.",
        parameters: z.object({
          utterance: z.string().describe("Caller slot choice, e.g. 2 PM or the second one"),
          slot_iso: z.string().optional().describe("ISO timestamp if explicitly known"),
        }),
        execute: async ({ utterance, slot_iso }, opts) => {
          const ctx = requireCallContext(opts);
          const result = await withSlowToolFiller(opts, "One moment.", async () =>
            domainSelectSlot({
              ctx,
              utterance,
              slotIso: slot_iso,
            }),
          );
          stashContext(opts, ctx);
          return formatToolResult(result);
        },
      }),
    );
  }

  if (allowed.has("confirm_booking")) {
    tools.push(
      llm.tool({
        name: "confirm_booking",
        description: "Confirm or decline booking the held appointment slot.",
        parameters: z.object({
          confirmed: z.boolean().describe("True when caller explicitly confirms booking"),
        }),
        execute: async ({ confirmed }, opts) => {
          const ctx = requireCallContext(opts);
          const result = await withSlowToolFiller(opts, "One moment.", async () =>
            domainConfirmBooking({ ctx, confirmed }),
          );
          stashContext(opts, ctx);
          return formatToolResult(result);
        },
      }),
    );
  }

  if (allowed.has("request_human")) {
    tools.push(
      llm.tool({
        name: "request_human",
        description: "Transfer or escalate to a human when the caller requests it.",
        parameters: z.object({
          reason: z.string().optional(),
        }),
        execute: async ({ reason }) => {
          return JSON.stringify({
            ok: true,
            speak: "Let me connect you with someone who can help.",
            action: "transfer_requested",
            reason: reason || "caller requested human",
          });
        },
      }),
    );
  }

  return { tools, taskId };
}

export function createAmyAgent(callContext: LiveKitCallContext) {
  const { tools, taskId } = buildAmyToolList(callContext);
  const instructions = [
    buildAmyLiveKitPermanentPrompt(callContext.businessName),
    buildAmyTaskContextBlock({
      active_task: taskId,
      ...taskContextPayload(callContext),
    }),
  ].join("\n\n");

  return voice.Agent.create<AmyProcessUserData>({
    instructions,
    tools: llm.toToolContext(tools),
  });
}
