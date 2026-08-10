import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildAmyAgentInstructions } from "@/lib/voice/agent-runtime/build-amy-instructions";
import { autoCaptureCallerInformationFromUtterance } from "@/lib/voice/agent-runtime/auto-capture-caller-info";
import { executeDeterministicPipeline } from "@/lib/voice/agent-runtime/deterministic-executor";
import {
  isSemanticToolName,
  resolveSemanticToolInvocation,
} from "@/lib/voice/agent-runtime/resolve-semantic-tool";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { hasBookingReceipt } from "@/lib/voice/workflow-runtime/completion-guards";
import {
  openAiChatWithTools,
  type OpenAiChatMessage,
  type OpenAiFunctionTool,
} from "./openai-tool-chat";
import { executeWorkflowTool } from "./workflow-tool-executor";
import { autoApplyCallerIntentFromUtterance } from "@/lib/voice/workflow-runtime/auto-intent";

const TOOL_SCHEMAS: Record<string, OpenAiFunctionTool> = {
  capture_caller_information: {
    name: "capture_caller_information",
    description:
      "Save structured information the caller just provided (name, email, phone, address, service issue, etc.).",
    parameters: {
      type: "object",
      properties: {
        extracted_fields: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        utterance: { type: "string" },
        intent: { type: "string" },
      },
    },
  },
  choose_appointment_time: {
    name: "choose_appointment_time",
    description: "Record which offered appointment time the caller chose.",
    parameters: {
      type: "object",
      properties: {
        slot_id: { type: "string", description: "Slot id from the active capability context" },
        selection: { type: "string", description: "How the caller described their choice" },
      },
      required: ["slot_id"],
    },
  },
  confirm_action: {
    name: "confirm_action",
    description: "Commit the held appointment after explicit caller confirmation.",
    parameters: {
      type: "object",
      properties: {
        confirmed: { type: "boolean" },
      },
      required: ["confirmed"],
    },
  },
  detect_caller_intent: {
    name: "detect_caller_intent",
    description: "Detect whether the caller wants to book, reschedule, cancel, or has an emergency.",
    parameters: {
      type: "object",
      properties: {
        utterance: { type: "string" },
      },
    },
  },
  answer_business_question: {
    name: "answer_business_question",
    description: "Answer configured business questions such as pricing or hours.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
      },
      required: ["topic"],
    },
  },
  modify_appointment: {
    name: "modify_appointment",
    description: "Find, reschedule, or cancel an existing appointment.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["find", "reschedule", "cancel"] },
        appointment_id: { type: "string" },
        slot_id: { type: "string" },
        confirmed: { type: "boolean" },
        reason: { type: "string" },
        phone: { type: "string" },
      },
      required: ["action"],
    },
  },
  take_message: {
    name: "take_message",
    description: "Capture a message for the business.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        caller_name: { type: "string" },
      },
      required: ["message"],
    },
  },
  transfer_to_human: {
    name: "transfer_to_human",
    description: "Transfer to a human after the caller confirms.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
  end_call: {
    name: "end_call",
    description: "End the call politely after workflow completion.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
};

export type ConversationTurnResult = {
  ctx: LiveKitCallContext;
  assistantText: string;
  toolExecutions: Array<{
    toolName: string;
    ok: boolean;
    speak: string;
    blocked?: boolean;
  }>;
  bookingComplete: boolean;
  messages: OpenAiChatMessage[];
};

function toolsForContext(ctx: LiveKitCallContext): OpenAiFunctionTool[] {
  const { allowedToolNames } = compileToolsForCallContext(ctx);
  return [...allowedToolNames]
    .map((name) => TOOL_SCHEMAS[name])
    .filter((tool): tool is OpenAiFunctionTool => Boolean(tool));
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function buildAmySystemMessage(ctx: LiveKitCallContext): OpenAiChatMessage {
  return {
    role: "system",
    content: buildAmyAgentInstructions(ctx),
  };
}

export function buildConversationMessages(ctx: LiveKitCallContext): OpenAiChatMessage[] {
  return [buildAmySystemMessage(ctx)];
}

export function refreshAmySystemMessage(
  messages: OpenAiChatMessage[],
  ctx: LiveKitCallContext,
): OpenAiChatMessage[] {
  const system = buildAmySystemMessage(ctx);
  if (!messages.length) return [system];
  if (messages[0]?.role === "system") return [system, ...messages.slice(1)];
  return [system, ...messages];
}

export function snapshotState(ctx: LiveKitCallContext): Record<string, unknown> {
  const canonical = ctx.canonicalWorkflow;
  return {
    workflowState: ctx.session.currentState,
    currentNodeId: canonical?.currentNodeId || ctx.session.currentNodeId,
    expectedNextAction: canonical?.expectedNextAction,
    readyForAvailability: canonical?.readyForAvailability,
    missingFieldIds: canonical?.missingFieldIds || ctx.session.missingFieldIds,
    heldSlot: ctx.session.heldSlot || ctx.session.selectedSlot,
    bookingId: ctx.session.bookingId,
    availableSlotCount: (ctx.session.availableSlots || []).length,
  };
}

/**
 * Process one caller utterance through the real workflow backend + production LLM tool loop.
 */
export async function processCallerTurn(input: {
  ctx: LiveKitCallContext;
  userText: string;
  messages: OpenAiChatMessage[];
  maxToolRounds?: number;
}): Promise<ConversationTurnResult> {
  const messages = [...input.messages, { role: "user" as const, content: input.userText }];
  let ctx = input.ctx;
  ctx.session.lastUserUtterance = input.userText;
  const toolExecutions: ConversationTurnResult["toolExecutions"] = [];
  const maxRounds = input.maxToolRounds ?? 10;
  let assistantText = "";

  const autoCapture = await autoCaptureCallerInformationFromUtterance({
    ctx,
    userText: input.userText,
  });
  ctx = autoCapture.ctx;
  if (autoCapture.applied) {
    toolExecutions.push({
      toolName: "capture_caller_information",
      ok: true,
      speak: autoCapture.speak || "Caller information captured.",
    });
  }

  const intentCalled = false;
  const autoIntent = await autoApplyCallerIntentFromUtterance({
    ctx,
    userText: input.userText,
    intentToolAlreadyCalled: intentCalled,
  });
  ctx = autoIntent.ctx;
  if (autoIntent.applied) {
    toolExecutions.push({
      toolName: "detect_caller_intent",
      ok: true,
      speak: "Intent detected from caller utterance.",
    });
  }

  const prePipeline = await executeDeterministicPipeline({
    ctx,
    preferenceSpoken: input.userText,
  });
  ctx = prePipeline.ctx;
  for (const step of prePipeline.steps) {
    toolExecutions.push({
      toolName: step.toolName,
      ok: step.ok,
      speak: step.speak,
    });
  }

  for (let round = 0; round < maxRounds; round++) {
    const tools = toolsForContext(ctx);
    const syncedMessages = refreshAmySystemMessage(messages, ctx);
    messages.splice(0, messages.length, ...syncedMessages);
    const { message } = await openAiChatWithTools({ messages, tools });

    if ("tool_calls" in message && message.tool_calls?.length) {
      messages.push(message);
      for (const call of message.tool_calls) {
        const args = parseToolArgs(call.function.arguments);
        const execution = await executeWorkflowTool({
          ctx,
          toolName: call.function.name,
          args,
        });
        ctx = execution.ctx;
        toolExecutions.push({
          toolName: execution.toolName,
          ok: execution.result.ok,
          speak: execution.result.speak,
          blocked: execution.blocked,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: execution.serialized,
        });
      }
      continue;
    }

    assistantText = "content" in message ? String(message.content || "").trim() : "";
    if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
    break;
  }

  return {
    ctx,
    assistantText,
    toolExecutions,
    bookingComplete: hasBookingReceipt(ctx.session),
    messages,
  };
}

export function formatTurnReport(input: {
  turn: number;
  userText: string;
  result: ConversationTurnResult;
}): string {
  const lines = [
    `\n── Turn ${input.turn} ──`,
    `Caller: ${input.userText}`,
  ];

  for (const tool of input.result.toolExecutions) {
    const status = tool.blocked ? "BLOCKED" : tool.ok ? "ok" : "FAIL";
    lines.push(`  [tool] ${tool.toolName} (${status}): ${tool.speak}`);
  }

  if (input.result.assistantText) {
    lines.push(`Amy: ${input.result.assistantText}`);
  }

  const state = snapshotState(input.result.ctx);
  lines.push(
    `  state: node=${state.currentNodeId} action=${state.expectedNextAction} missing=${JSON.stringify(state.missingFieldIds)} held=${state.heldSlot || "none"} booking=${state.bookingId || "none"}`,
  );

  return lines.join("\n");
}
