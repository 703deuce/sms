import type { LiveKitCallContext } from "@/lib/voice/domain-actions";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { hasAvailableSlots } from "@/lib/voice/workflow-runtime/completion-guards";
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
 * Mimics what a competent LLM should do at each workflow stage.
 */
export function planDeterministicToolCalls(input: {
  ctx: LiveKitCallContext;
  userText: string;
}): DeterministicToolCall[] {
  const { allowedToolNames, canonical } = compileToolsForCallContext(input.ctx);
  const text = input.userText.trim();
  const lower = text.toLowerCase();

  if (allowedToolNames.has("submit_caller_information")) {
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
          name: "submit_caller_information",
          args: {
            extracted_fields: prepared.fields,
            utterance: text,
          },
        },
      ];
    }
  }

  if (
    allowedToolNames.has("check_availability") &&
    canonical?.readyForAvailability &&
    !hasAvailableSlots(input.ctx.session) &&
    /tomorrow|morning|afternoon|earlier|available|time|schedule/i.test(text)
  ) {
    return [{ name: "check_availability", args: { spoken: text } }];
  }

  if (allowedToolNames.has("select_slot")) {
    const slots = input.ctx.session.availableSlots || [];
    if (/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(text) || /nine thirty|first|second|third|earlier|that one|that time/i.test(lower)) {
      return [{ name: "select_slot", args: { selection: text } }];
    }
    if (slots.length > 0 && /good|book|confirm|yes|works/i.test(lower)) {
      return [{ name: "select_slot", args: { selection: "the first one" } }];
    }
  }

  if (
    allowedToolNames.has("reschedule_appointment") &&
    canonical?.expectedNextAction === "reschedule_appointment" &&
    /yes|reschedule|confirm|please/i.test(lower)
  ) {
    const held = input.ctx.session.heldSlot || input.ctx.session.selectedSlot;
    const appointmentId = input.ctx.session.runtime.session_runtime?.foundAppointmentId;
    if (held && appointmentId) {
      return [
        {
          name: "reschedule_appointment",
          args: { appointment_id: appointmentId, new_starts_at: held, confirmed: true },
        },
      ];
    }
  }

  if (
    allowedToolNames.has("cancel_appointment") &&
    canonical?.expectedNextAction === "cancel_appointment" &&
    /yes|cancel|confirm|please/i.test(lower)
  ) {
    const appointmentId = input.ctx.session.runtime.session_runtime?.foundAppointmentId;
    if (appointmentId) {
      return [{ name: "cancel_appointment", args: { appointment_id: appointmentId, confirmed: true } }];
    }
  }

  if (allowedToolNames.has("find_appointments") && /reschedule|cancel|appointment/i.test(lower)) {
    return [{ name: "find_appointments", args: {} }];
  }

  if (
    allowedToolNames.has("confirm_booking") &&
    (/^(yes|yeah|yep|that's good|that is good|book it|confirm|sounds good)/i.test(lower) ||
      canonical?.expectedNextAction === "confirm_booking")
  ) {
    return [{ name: "confirm_booking", args: { confirmed: true } }];
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
