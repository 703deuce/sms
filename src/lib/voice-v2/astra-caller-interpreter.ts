import "server-only";

import { extractJsonFromLlm } from "@/lib/ai/llm";
import { openAiChatCompletion, getOpenAiApiKey } from "@/lib/ai/openai";
function astraBackendModel(): string {
  return (
    process.env.VOICE_V2_ASTRA_MODEL?.trim() ||
    process.env.OPENAI_LIVE_BACKEND_MODEL?.trim() ||
    "gpt-6-astra"
  );
}
import type { VoiceDialogGoal } from "./dialog-goal";
import {
  interpretCallerUtterance,
  type VoiceCallerIntentInterpretation,
  type VoiceCallerIntentEntities,
} from "./caller-intent-interpreter";

/** Astra may return meaning only — never workflow / dispatch authority. */
export type AstraCallerInterpretation = {
  active_goal: VoiceDialogGoal;
  facts: {
    requested_date?: string | null;
    requested_daypart?: string | null;
    requested_time?: string | null;
    [key: string]: unknown;
  };
  corrections: string[];
  explicit_action_requests: string[];
  ambiguities: string[];
  confidence: number;
  digression?: boolean;
};

const FORBIDDEN_ASTRA_KEYS = new Set([
  "stage",
  "required_action",
  "booking_confirmed",
  "offer_set_id",
  "allowed_next_actions",
  "forbidden_actions",
  "workflow_signal",
  "next_stage",
]);

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

function stripForbiddenKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (FORBIDDEN_ASTRA_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function parseAstraCallerInterpretation(raw: unknown): AstraCallerInterpretation | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = stripForbiddenKeys(raw as Record<string, unknown>);
  const goalRaw = String(obj.active_goal ?? "UNKNOWN").trim() as VoiceDialogGoal;
  const active_goal = VALID_GOALS.has(goalRaw) ? goalRaw : "UNKNOWN";
  const facts =
    obj.facts && typeof obj.facts === "object" && !Array.isArray(obj.facts)
      ? (obj.facts as AstraCallerInterpretation["facts"])
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
  };
}

export function astraToVoiceCallerIntent(
  astra: AstraCallerInterpretation,
  utterance: string,
): VoiceCallerIntentInterpretation {
  const entities: VoiceCallerIntentEntities = {
    requested_day: astra.facts.requested_date ?? null,
    requested_daypart: astra.facts.requested_daypart ?? null,
    requested_time: astra.facts.requested_time ?? null,
  };

  const explicit =
    astra.explicit_action_requests.length > 0 ||
    astra.active_goal === "CALLBACK_REQUEST" ||
    astra.active_goal === "TRANSFER_TO_HUMAN" ||
    astra.active_goal === "CANCEL_APPOINTMENT";

  return {
    intent: astra.active_goal,
    confidence: astra.confidence,
    explicit,
    evidence: utterance.slice(0, 240),
    entities,
    digression: Boolean(astra.digression) || astra.active_goal === "GENERAL_QUESTION",
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

export async function interpretCallerUtteranceWithAstra(input: {
  utterance: string;
  priorActiveGoal: VoiceDialogGoal;
  businessTimezone?: string;
}): Promise<{
  interpretation: VoiceCallerIntentInterpretation;
  source: "astra" | "deterministic";
  astra?: AstraCallerInterpretation;
}> {
  const utterance = input.utterance.trim();
  const prior = { activeGoal: input.priorActiveGoal };

  if (!isVoiceV2AstraInterpreterEnabled() || !utterance || !getOpenAiApiKey()) {
    return {
      interpretation: interpretCallerUtterance(utterance, prior),
      source: "deterministic",
    };
  }

  const model = astraBackendModel();
  const user = JSON.stringify({
    prior_active_goal: input.priorActiveGoal,
    business_timezone: input.businessTimezone ?? "America/New_York",
    caller_utterance: utterance,
  });

  try {
    const raw = await openAiChatCompletion(buildAstraSystemPrompt(), user, {
      model,
      temperature: 0.1,
      maxTokens: 400,
    });
    if (!raw) {
      return {
        interpretation: interpretCallerUtterance(utterance, prior),
        source: "deterministic",
      };
    }
    const parsed = parseAstraCallerInterpretation(extractJsonFromLlm(raw));
    if (!parsed) {
      return {
        interpretation: interpretCallerUtterance(utterance, prior),
        source: "deterministic",
      };
    }
    return {
      interpretation: astraToVoiceCallerIntent(parsed, utterance),
      source: "astra",
      astra: parsed,
    };
  } catch {
    return {
      interpretation: interpretCallerUtterance(utterance, prior),
      source: "deterministic",
    };
  }
}
