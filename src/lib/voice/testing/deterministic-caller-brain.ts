import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { buildSlotsPayload } from "@/lib/voice/domain-actions/tool-results";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { normalizeExtractedFields, inferFieldsFromUtterance } from "@/lib/voice/workflow-runtime/field-extraction";
import { prepareFieldsForPersistence } from "@/lib/voice/workflow-runtime/field-persist";
import type { OpenAiChatMessage } from "./openai-tool-chat";

function inferProblemField(ctx: LiveKitCallContext, text: string): Record<string, string> {
  const lower = text.toLowerCase();
  if (!/leak|broken|repair|fix|not working|issue|problem/.test(lower)) return {};
  const problemId = ctx.session.fieldManifest.find(
    (f) => f.field_id.includes("problem") && f.required && !ctx.session.collectedFields[f.field_id]?.trim(),
  )?.field_id;
  if (!problemId) return {};
  return { [problemId]: text };
}

export type DeterministicToolCall = {
  name: string;
  args: Record<string, unknown>;
};

/**
 * Rule-based caller brain for CI / offline testing when OPENAI_API_KEY is unavailable.
 * Mimics what a competent LLM should do at each workflow stage using semantic tool names.
 */
export function planDeterministicToolCalls(input: {
  ctx: LiveKitCallContext;
  userText: string;
}): DeterministicToolCall[] {
  const { allowedToolNames, canonical } = compileToolsForCallContext(input.ctx);
  const text = input.userText.trim();
  const lower = text.toLowerCase();

  if (allowedToolNames.has("capture_caller_information")) {
    const extracted = normalizeExtractedFields({
      session: input.ctx.session,
      extracted: {},
    });
    const inferred = inferFieldsFromUtterance({
      session: input.ctx.session,
      utterance: text,
    });
    const prepared = prepareFieldsForPersistence({
      session: input.ctx.session,
      extracted: { ...extracted, ...inferred, ...inferProblemField(input.ctx, text) },
      utterance: text,
    });
    if (Object.keys(prepared.fields).length > 0) {
      return [
        {
          name: "capture_caller_information",
          args: {
            extracted_fields: prepared.fields,
            utterance: text,
          },
        },
      ];
    }
  }

  if (allowedToolNames.has("choose_appointment_time")) {
    const slots = buildSlotsPayload(input.ctx.session);
    if (/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(text) || /nine thirty|first|second|third|earlier|that one|that time/i.test(lower)) {
      const slotId = slots[0]?.slotId;
      if (slotId) {
        return [{ name: "choose_appointment_time", args: { slot_id: slotId, selection: text } }];
      }
    }
    if (slots.length > 0 && /good|book|confirm|yes|works/i.test(lower)) {
      return [
        {
          name: "choose_appointment_time",
          args: { slot_id: slots[0].slotId, selection: "the first one" },
        },
      ];
    }
  }

  if (
    allowedToolNames.has("confirm_action") &&
    canonical?.expectedNextAction === "reschedule_appointment" &&
    /yes|reschedule|confirm|please/i.test(lower)
  ) {
    const held = input.ctx.session.heldSlot || input.ctx.session.selectedSlot;
    const appointmentId = input.ctx.session.runtime.session_runtime?.foundAppointmentId;
    if (held && appointmentId) {
      return [{ name: "confirm_action", args: { confirmed: true } }];
    }
  }

  if (
    allowedToolNames.has("confirm_action") &&
    canonical?.expectedNextAction === "cancel_appointment" &&
    /yes|cancel|confirm|please/i.test(lower)
  ) {
    const appointmentId = input.ctx.session.runtime.session_runtime?.foundAppointmentId;
    if (appointmentId) {
      return [{ name: "confirm_action", args: { confirmed: true } }];
    }
  }

  if (allowedToolNames.has("modify_appointment") && /reschedule|cancel|appointment/i.test(lower)) {
    return [{ name: "modify_appointment", args: { action: "find" } }];
  }

  if (
    allowedToolNames.has("confirm_action") &&
    (/^(yes|yeah|yep|that's good|that is good|book it|confirm|sounds good)/i.test(lower) ||
      canonical?.expectedNextAction === "confirm_booking")
  ) {
    return [{ name: "confirm_action", args: { confirmed: true } }];
  }

  if (allowedToolNames.has("detect_caller_intent") && /book|appointment|repair|fix|leak|broken/i.test(lower)) {
    return [{ name: "detect_caller_intent", args: { utterance: text } }];
  }

  if (allowedToolNames.has("detect_caller_intent") && /reschedule|cancel/i.test(lower)) {
    return [{ name: "detect_caller_intent", args: { utterance: text } }];
  }

  return [];
}

export function deterministicAssistantReply(input: {
  userText: string;
  toolCalls: DeterministicToolCall[];
  lastSpeak?: string;
}): string {
  if (input.lastSpeak?.trim()) return input.lastSpeak;
  if (!input.toolCalls.length) {
    return "I understand. Let me help with that.";
  }
  return "";
}

export function appendDeterministicMessages(input: {
  messages: OpenAiChatMessage[];
  userText: string;
  assistantText: string;
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown>; result: string }>;
}): OpenAiChatMessage[] {
  const next: OpenAiChatMessage[] = [
    ...input.messages,
    { role: "user", content: input.userText },
  ];

  if (input.toolCalls.length) {
    next.push({
      role: "assistant",
      content: input.assistantText || null,
      tool_calls: input.toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args),
        },
      })),
    });
    for (const call of input.toolCalls) {
      next.push({
        role: "tool",
        tool_call_id: call.id,
        content: call.result,
      });
    }
  } else if (input.assistantText) {
    next.push({ role: "assistant", content: input.assistantText });
  }

  return next;
}
