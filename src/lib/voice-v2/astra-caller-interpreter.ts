import "server-only";

import { createHash } from "node:crypto";
import { extractJsonFromLlm } from "@/lib/ai/llm";
import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";
import type { VoiceDialogGoal } from "./dialog-goal";
import type {
  CallerInterpreter,
  CallerInterpretationResult,
  CallerMeaning,
  CallerMeaningFacts,
  InterpreterContext,
} from "./caller-meaning";
import {
  detectInterpreterWorkflowAuthorityViolation,
  logInterpreterWorkflowAuthorityViolation,
  shouldFailOnInterpreterSchemaViolation,
} from "./caller-interpreter-schema";

function astraBackendModel(): string {
  return (
    process.env.VOICE_V2_ASTRA_MODEL?.trim() ||
    process.env.OPENAI_LIVE_BACKEND_MODEL?.trim() ||
    "gpt-6-astra"
  );
}

function astraTimeoutMs(): number {
  const raw = Number(process.env.VOICE_V2_ASTRA_INTERPRETER_TIMEOUT_MS ?? 8000);
  return Number.isFinite(raw) && raw >= 1000 ? Math.min(raw, 30_000) : 8000;
}

const VALID_GOALS = new Set<VoiceDialogGoal>([
  "BOOK_APPOINTMENT",
  "CHANGE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CALLBACK_REQUEST",
  "GENERAL_QUESTION",
  "TRANSFER_TO_HUMAN",
  "LEAVE_MESSAGE",
  "UNKNOWN",
]);

export function isVoiceV2AstraInterpreterEnabled(): boolean {
  const v = process.env.VOICE_V2_ASTRA_INTERPRETER?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return process.env.VOICE_V2_ASTRA_INTERPRETER_DEFAULT === "1";
}

export function parseCallerMeaningFromModelJson(
  raw: unknown,
  utterance: string,
  meta?: { callId?: string; utteranceId?: string },
): CallerMeaning | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const violation = detectInterpreterWorkflowAuthorityViolation(obj);
  if (violation) {
    logInterpreterWorkflowAuthorityViolation({
      call_id: meta?.callId ?? null,
      utterance_id: meta?.utteranceId ?? null,
      forbidden_keys: violation.forbiddenKeys,
    });
    if (shouldFailOnInterpreterSchemaViolation()) {
      throw new Error(
        `Interpreter schema violation: ${violation.forbiddenKeys.join(", ")}`,
      );
    }
    return null;
  }

  const goalRaw = String(obj.active_goal ?? "UNKNOWN").trim() as VoiceDialogGoal;
  const active_goal = VALID_GOALS.has(goalRaw) ? goalRaw : "UNKNOWN";
  const facts =
    obj.facts && typeof obj.facts === "object" && !Array.isArray(obj.facts)
      ? (obj.facts as CallerMeaningFacts)
      : {};
  const corrections = Array.isArray(obj.corrections)
    ? obj.corrections.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const explicit_action_requests = Array.isArray(obj.explicit_action_requests)
    ? obj.explicit_action_requests.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const ambiguities = Array.isArray(obj.ambiguities)
    ? obj.ambiguities.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const confidence = Math.max(0, Math.min(1, Number(obj.confidence) || 0.5));
  const digression = Boolean(obj.digression);

  return {
    active_goal,
    facts,
    corrections,
    explicit_action_requests,
    ambiguities,
    confidence,
    digression,
    evidence: utterance.trim(),
  };
}

function buildAstraSystemPrompt(): string {
  return `You interpret ONE stable caller utterance for a voice booking assistant.
Return STRICT JSON only. You do NOT choose workflow stage, tools, FIND, BOOK, or offer sets.

Forbidden output keys (never include): stage, required_action, booking_confirmed, offer_set_id, allowed_next_actions, forbidden_actions, workflow_signal, next_stage.

Output shape:
{
  "active_goal": "BOOK_APPOINTMENT" | "CHANGE_APPOINTMENT" | "CANCEL_APPOINTMENT" | "CALLBACK_REQUEST" | "GENERAL_QUESTION" | "TRANSFER_TO_HUMAN" | "LEAVE_MESSAGE" | "UNKNOWN",
  "facts": {
    "requested_date": "YYYY-MM-DD or null",
    "requested_daypart": "morning|afternoon|evening|noon or null",
    "requested_time": "localized time phrase or null"
  },
  "corrections": ["short phrases the caller used to correct earlier info"],
  "explicit_action_requests": ["callback", "transfer", "cancel booking", etc.],
  "ambiguities": ["what is unclear"],
  "confidence": 0.0-1.0,
  "digression": false
}

Rules:
- Corrections like "actually Thursday" belong in corrections and update facts.
- Side questions during booking → digression true, keep booking goal in active_goal when still booking.
- Do not invent dates; use null when not stated.`;
}

export const astraCallerInterpreter: CallerInterpreter = {
  implementationId: "astra",

  async interpret(ctx: InterpreterContext): Promise<CallerInterpretationResult | null> {
    const started = Date.now();
    const utterance = ctx.stable.text.trim();
    if (!utterance || !getOpenAiApiKey()) return null;

    const model = astraBackendModel();
    const user = JSON.stringify({
      prior_active_goal: ctx.priorActiveGoal,
      business_timezone: ctx.businessTimezone,
      caller_utterance: utterance,
      utterance_id: ctx.stable.utterance_id,
      revision: ctx.stable.revision,
    });

    try {
      const raw = await Promise.race([
        openAiChatCompletion(buildAstraSystemPrompt(), user, {
          model,
          temperature: 0.1,
          maxTokens: 400,
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("astra_interpreter_timeout")), astraTimeoutMs()),
        ),
      ]);
      if (!raw) return null;

      const parsed = parseCallerMeaningFromModelJson(extractJsonFromLlm(raw), utterance, {
        callId: ctx.callId,
        utteranceId: ctx.stable.utterance_id,
      });
      if (!parsed) return null;

      return {
        meaning: parsed,
        implementationId: this.implementationId,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      console.error(
        `VOICE_ASTRA_INTERPRETER_FAILED ${JSON.stringify({
          call_id: ctx.callId ?? null,
          utterance_id: ctx.stable.utterance_id,
          error: err instanceof Error ? err.message : String(err),
        })}`,
      );
      return null;
    }
  },
};

export function stableUtteranceTextHash(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
}
