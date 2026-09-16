import "server-only";

import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";
import type { VoiceV2IntakeSchema, VoiceV2IntakeState } from "../intake/types";
import {
  buildDynamicExtractionSchema,
  extractionSchemaFieldKeys,
} from "./extraction-schema";
import type { VoiceV2MultichannelTranscript, VoiceV2PostCallFieldCandidate } from "./types";
import {
  completeExtractionRowsForSchema,
  normalizeStructuredExtractionPayload,
  type OrderedTranscriptTurn,
  structuredRowsToPostCallCandidates,
  type StructuredPostCallExtractionResult,
} from "./structured-extraction-types";

export function buildOrderedTranscriptTurns(
  transcript: VoiceV2MultichannelTranscript,
): OrderedTranscriptTurn[] {
  const turns: OrderedTranscriptTurn[] = [];
  const full = transcript.fullText || "";
  for (const [i, line] of full.split(/\n+/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(caller|customer|user|agent|assistant|amy|business):\s*(.+)$/i);
    if (m) {
      const sp = m[1].toLowerCase();
      const speaker =
        sp === "caller" || sp === "customer" || sp === "user" ? "caller" : "agent";
      turns.push({ speaker, text: m[2].trim(), lineIndex: i });
      continue;
    }
    turns.push({ speaker: "caller", text: trimmed, lineIndex: i });
  }
  if (!turns.length && transcript.callerText) {
    for (const part of transcript.callerText.split(/(?<=[.!?])\s+/)) {
      const t = part.trim();
      if (t) turns.push({ speaker: "caller", text: t });
    }
  }
  return turns;
}

function liveValuesForPrompt(intakeState: VoiceV2IntakeState, schema: VoiceV2IntakeSchema) {
  const out: Record<string, string> = {};
  for (const f of schema.fields) {
    const v = intakeState[f.key]?.value?.trim();
    if (v) out[f.key] = v;
  }
  return out;
}

export function buildStructuredExtractionSystemPrompt(): string {
  return `You are a post-call structured field extractor for a voice agent platform.
You receive the FULL independent Deepgram transcript (caller + agent/Amy turns) and a PINNED field schema.
Return STRICT JSON only — no markdown, no prose summary.

You are NOT a conversational agent. You do not speak, call tools, book, transfer, or send SMS.
Your ONLY job: extract caller-provided values for the configured fields from the transcript.

For EVERY field in extractionSchema, output exactly one row in "fields":
- fieldKey (exact key from schema)
- status: FOUND | NOT_FOUND | AMBIGUOUS
- value: string when FOUND, else null
- confidence: 0.0-1.0 when FOUND or AMBIGUOUS
- evidence: array of { speaker: "CALLER"|"AGENT", text, startMs?, endMs? } — caller speech is primary proof
- isExplicitCorrection: true when caller clearly corrects an earlier value

Rules:
- Use full conversational context (agent question → bare caller answer maps to the field).
- Agent statements provide context only; do NOT treat agent paraphrase as caller proof unless caller confirms.
- Do NOT invent values. NOT_FOUND if never established. AMBIGUOUS if conflicting/unclear.
- Latest explicit caller correction wins when detectable.
- Normalize phone/email when transcript clearly supports it; enum must match allowedValues or AMBIGUOUS/NOT_FOUND.

Output shape:
{"fields":[{"fieldKey":"...","status":"FOUND","value":"...","confidence":0.9,"evidence":[{"speaker":"CALLER","text":"..."}],"isExplicitCorrection":false}]}`;
}

export function buildStructuredExtractionUserPayload(input: {
  schema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
  intakeState: VoiceV2IntakeState;
  primaryOutcome?: string;
}): string {
  const turns = buildOrderedTranscriptTurns(input.transcript);
  const extractionSchema = buildDynamicExtractionSchema(input.schema);
  return JSON.stringify(
    {
      primaryOutcome: input.primaryOutcome || "NONE",
      extractionSchema,
      liveCallContextValuesForComparisonOnly: liveValuesForPrompt(input.intakeState, input.schema),
      orderedTranscript: turns.map((t) => ({
        speaker: t.speaker === "caller" ? "CALLER" : "AGENT",
        text: t.text,
        startMs: t.startMs ?? null,
        endMs: t.endMs ?? null,
      })),
    },
    null,
    2,
  );
}

/** Test hook: parse model JSON without calling an LLM. */
export function parseStructuredExtractionJson(
  raw: unknown,
  schema: VoiceV2IntakeSchema,
): StructuredPostCallExtractionResult | null {
  const enabled = new Set(extractionSchemaFieldKeys(schema));
  const parsed = normalizeStructuredExtractionPayload(raw, enabled, schema);
  if (!parsed) return null;
  return {
    fields: completeExtractionRowsForSchema(schema, parsed.fields),
  };
}

export async function runStructuredPostCallFieldExtraction(input: {
  schema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
  intakeState: VoiceV2IntakeState;
  primaryOutcome?: string;
}): Promise<StructuredPostCallExtractionResult | null> {
  const system = buildStructuredExtractionSystemPrompt();
  const user = buildStructuredExtractionUserPayload(input);
  const hit = await mctbSemanticStructuredJson<{ fields: unknown[] }>({
    system,
    user,
    temperature: 0.05,
    maxTokens: 4000,
    model: process.env.VOICE_V2_POST_CALL_EXTRACTION_MODEL?.trim() || undefined,
  });
  if (!hit?.data) return null;
  const enabled = new Set(extractionSchemaFieldKeys(input.schema));
  const parsed = normalizeStructuredExtractionPayload(hit.data, enabled, input.schema);
  if (!parsed) return null;
  return {
    fields: completeExtractionRowsForSchema(input.schema, parsed.fields),
    model: hit.model,
    provider: hit.provider,
  };
}

export type PostCallLlmExtractionOutcome = {
  candidates: VoiceV2PostCallFieldCandidate[];
  extraction: StructuredPostCallExtractionResult | null;
  source: "llm" | "llm+fixture";
  extractionFailed: boolean;
};

/**
 * LLM-only post-call field extraction (schema-dynamic per pinned call).
 * No regex/rule primary extraction — deterministic reconciliation is separate.
 */
export async function extractPostCallFieldCandidatesWithAi(input: {
  pinnedSchema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
  intakeState?: VoiceV2IntakeState;
  primaryOutcome?: string;
  /** Headless/tests: inject structured JSON result (simulates LLM) */
  structuredOverride?: StructuredPostCallExtractionResult | null;
}): Promise<PostCallLlmExtractionOutcome> {
  if (input.structuredOverride) {
    const complete = {
      ...input.structuredOverride,
      fields: completeExtractionRowsForSchema(
        input.pinnedSchema,
        input.structuredOverride.fields,
      ),
    };
    return {
      candidates: structuredRowsToPostCallCandidates(complete.fields),
      extraction: complete,
      source: "llm+fixture",
      extractionFailed: false,
    };
  }

  const structured = await runStructuredPostCallFieldExtraction({
    schema: input.pinnedSchema,
    transcript: input.transcript,
    intakeState: input.intakeState || {},
    primaryOutcome: input.primaryOutcome,
  });

  if (!structured?.fields.length) {
    return {
      candidates: [],
      extraction: null,
      source: "llm",
      extractionFailed: true,
    };
  }

  return {
    candidates: structuredRowsToPostCallCandidates(structured.fields),
    extraction: structured,
    source: "llm",
    extractionFailed: false,
  };
}
