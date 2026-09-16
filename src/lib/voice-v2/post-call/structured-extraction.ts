import "server-only";

import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";
import type { VoiceV2IntakeSchema, VoiceV2IntakeState } from "../intake/types";
import { extractPostCallFieldCandidates } from "./field-extraction";
import type { VoiceV2MultichannelTranscript, VoiceV2PostCallFieldCandidate } from "./types";
import {
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

function schemaDescriptor(schema: VoiceV2IntakeSchema) {
  return schema.fields.map((f) => ({
    fieldKey: f.key,
    label: f.label,
    valueType: f.valueType,
    requirementLevel: f.requirementLevel,
    questionText: f.questionText,
  }));
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
You receive the FULL call transcript (caller + agent turns) and a pinned field schema.
Return STRICT JSON only — no markdown.

For EVERY enabled field in the schema, output one row in "fields":
- fieldKey (string, exact key from schema)
- status: FOUND | NOT_FOUND | AMBIGUOUS
- candidateValue: string when FOUND, else null
- confidence: 0.0-1.0 when FOUND or AMBIGUOUS
- evidenceSpeaker: "caller" | "agent" (caller speech is primary evidence for caller facts)
- evidenceSpan: short quote from transcript supporting the value
- isExplicitCorrection: true when caller clearly corrects an earlier value (e.g. "Actually it's Patrice")

Rules:
- Use conversational context (e.g. agent asks "mother's name?" → caller answer maps to mother_s_name).
- Do NOT invent values not supported by transcript.
- Custom fields (dinosaury, purple_monkey_count, etc.) use the same rules as built-ins.
- If two conflicting values and unclear which is final → AMBIGUOUS.
- If never mentioned → NOT_FOUND.

Output shape:
{"fields":[{"fieldKey":"...","status":"FOUND","candidateValue":"...","confidence":0.9,"evidenceSpeaker":"caller","evidenceSpan":"...","isExplicitCorrection":false}]}`;
}

export function buildStructuredExtractionUserPayload(input: {
  schema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
  intakeState: VoiceV2IntakeState;
  primaryOutcome?: string;
}): string {
  const turns = buildOrderedTranscriptTurns(input.transcript);
  return JSON.stringify(
    {
      primaryOutcome: input.primaryOutcome || "NONE",
      pinnedSchemaRevision: input.schema.fields.length,
      fields: schemaDescriptor(input.schema),
      liveCallContextValues: liveValuesForPrompt(input.intakeState, input.schema),
      orderedTranscript: turns,
      callerChannelText: input.transcript.callerText,
      agentChannelText: input.transcript.agentText,
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
  const enabled = new Set(schema.fields.map((f) => f.key));
  return normalizeStructuredExtractionPayload(raw, enabled);
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
  });
  if (!hit?.data) return null;
  const enabled = new Set(input.schema.fields.map((f) => f.key));
  const parsed = normalizeStructuredExtractionPayload(hit.data, enabled);
  if (!parsed) return null;
  return { ...parsed, model: hit.model, provider: hit.provider };
}

function mergeCandidates(
  ruleBased: VoiceV2PostCallFieldCandidate[],
  structured: VoiceV2PostCallFieldCandidate[],
): VoiceV2PostCallFieldCandidate[] {
  const byKey = new Map<string, VoiceV2PostCallFieldCandidate>();
  for (const r of ruleBased) byKey.set(r.fieldKey, r);
  for (const s of structured) {
    const prev = byKey.get(s.fieldKey);
    if (!prev) {
      byKey.set(s.fieldKey, s);
      continue;
    }
    if (s.verdict === "AMBIGUOUS") {
      byKey.set(s.fieldKey, { ...s, confidence: s.confidence ?? 0.4 });
      continue;
    }
    if (s.verdict === "FOUND") {
      const sConf = s.confidence ?? 0.75;
      const pConf = prev.confidence ?? 0.5;
      if (s.isExplicitCorrection || sConf >= pConf) {
        byKey.set(s.fieldKey, s);
      }
      continue;
    }
    if (prev.verdict !== "FOUND" && s.verdict === "NOT_FOUND") {
      byKey.set(s.fieldKey, s);
    }
  }
  return [...byKey.values()];
}

/**
 * Rule-based extraction + optional structured LLM pass (merged).
 * LLM is NOT a conversational agent — single JSON extraction task.
 */
export async function extractPostCallFieldCandidatesWithAi(input: {
  pinnedSchema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
  intakeState?: VoiceV2IntakeState;
  primaryOutcome?: string;
  /** Headless/tests: skip network LLM */
  skipLlm?: boolean;
  /** Headless/tests: inject structured JSON result */
  structuredOverride?: StructuredPostCallExtractionResult | null;
}): Promise<{
  candidates: VoiceV2PostCallFieldCandidate[];
  extraction: StructuredPostCallExtractionResult | null;
  source: "rules" | "rules+llm" | "rules+fixture";
}> {
  const ruleBased = extractPostCallFieldCandidates({
    pinnedSchema: input.pinnedSchema,
    transcript: input.transcript,
  });

  if (input.structuredOverride) {
    const structured = structuredRowsToPostCallCandidates(input.structuredOverride.fields);
    return {
      candidates: mergeCandidates(ruleBased, structured),
      extraction: input.structuredOverride,
      source: "rules+fixture",
    };
  }

  if (input.skipLlm || process.env.VOICE_V2_POST_CALL_SKIP_LLM === "1") {
    return { candidates: ruleBased, extraction: null, source: "rules" };
  }

  const structured = await runStructuredPostCallFieldExtraction({
    schema: input.pinnedSchema,
    transcript: input.transcript,
    intakeState: input.intakeState || {},
    primaryOutcome: input.primaryOutcome,
  });

  if (!structured?.fields.length) {
    return { candidates: ruleBased, extraction: structured, source: "rules" };
  }

  const fromLlm = structuredRowsToPostCallCandidates(structured.fields);
  return {
    candidates: mergeCandidates(ruleBased, fromLlm),
    extraction: structured,
    source: "rules+llm",
  };
}
