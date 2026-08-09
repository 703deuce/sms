import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { taskContextPayload, taskForWorkflowState } from "@/lib/voice/domain-actions";
import {
  buildAmyLiveKitPermanentPrompt,
  buildAmyTaskContextBlock,
} from "@/lib/agents/appointment-booking/intelligence/amy-livekit-prompt";
import { taskTypeForSession } from "@/lib/voice/workflow-tasks/registry";
import "@/lib/voice/workflow-tasks/registry";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { hasBookingReceipt } from "@/lib/voice/workflow-runtime/completion-guards";
import {
  openAiChatWithTools,
  type OpenAiChatMessage,
  type OpenAiFunctionTool,
} from "./openai-tool-chat";
import { executeWorkflowTool } from "./workflow-tool-executor";

const TOOL_SCHEMAS: Record<string, OpenAiFunctionTool> = {
  submit_caller_information: {
    name: "submit_caller_information",
    description:
      "Persist structured information the caller just provided. Call whenever the caller gives name, email, phone, address, service issue, or other booking details.",
    parameters: {
      type: "object",
      properties: {
        extracted_fields: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Map of field id or alias to the value the caller provided",
        },
        utterance: { type: "string", description: "Raw caller utterance when structured fields are unclear" },
        intent: { type: "string", description: "Caller intent if newly understood" },
      },
    },
  },
  check_availability: {
    name: "check_availability",
    description:
      "Checks real calendar availability. Call only after required booking information has been collected.",
    parameters: {
      type: "object",
      properties: {
        spoken: { type: "string", description: "Caller time preference" },
      },
      required: ["spoken"],
    },
  },
  select_slot: {
    name: "select_slot",
    description: "Select one of the appointment slots previously returned by check_availability.",
    parameters: {
      type: "object",
      properties: {
        selection: { type: "string", description: "Caller slot choice in natural language" },
        slot_iso: { type: "string", description: "ISO timestamp only if explicitly known" },
      },
      required: ["selection"],
    },
  },
  confirm_booking: {
    name: "confirm_booking",
    description:
      "Creates the real appointment after explicit caller confirmation. Required before saying the appointment is booked.",
    parameters: {
      type: "object",
      properties: {
        confirmed: { type: "boolean", description: "True when caller explicitly confirms booking" },
      },
      required: ["confirmed"],
    },
  },
  lookup_customer: {
    name: "lookup_customer",
    description: "Look up an existing customer by phone, email, or name.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        name: { type: "string" },
      },
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
  validate_eligibility: {
    name: "validate_eligibility",
    description: "Validate whether the service address is in the business service area.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string" },
      },
    },
  },
  classify_intent: {
    name: "classify_intent",
    description: "Classify urgency and safety for triage routing.",
    parameters: {
      type: "object",
      properties: {
        utterance: { type: "string" },
      },
    },
  },
  get_business_answer: {
    name: "get_business_answer",
    description: "Answer configured business questions such as pricing or hours.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
      },
      required: ["topic"],
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
  request_human: {
    name: "request_human",
    description: "Transfer or escalate to a human.",
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

function buildAmyAgentInstructions(ctx: LiveKitCallContext): string {
  const taskId = taskTypeForSession(ctx.session) || taskForWorkflowState(ctx.session.currentState);
  const { envelope, canonical } = compileToolsForCallContext(ctx);
  return [
    buildAmyLiveKitPermanentPrompt(ctx.businessName),
    buildAmyTaskContextBlock({
      active_task: taskId,
      next_action: canonical?.expectedNextAction,
      workflow_id: ctx.workflowRef?.workflowId,
      workflow_version: ctx.workflowRef?.version,
      current_node_id: canonical?.currentNodeId,
      expected_next_action: canonical?.expectedNextAction,
      ready_for_availability: canonical?.readyForAvailability,
      ...taskContextPayload(ctx),
    }),
    envelope.taskInstructions ? `TASK INSTRUCTIONS:\n${envelope.taskInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildConversationMessages(ctx: LiveKitCallContext): OpenAiChatMessage[] {
  return [
    {
      role: "system",
      content: [
        buildAmyAgentInstructions(ctx),
        "",
        "TEXT SIMULATOR MODE",
        "You are being tested via text instead of voice. Respond as Amy would on a phone call.",
        "Keep replies short. Use tools whenever the runtime requires an action.",
        "Never claim a booking succeeded unless confirm_booking returns success.",
      ].join("\n"),
    },
  ];
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
  const toolExecutions: ConversationTurnResult["toolExecutions"] = [];
  const maxRounds = input.maxToolRounds ?? 6;
  let assistantText = "";

  for (let round = 0; round < maxRounds; round++) {
    const tools = toolsForContext(ctx);
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
