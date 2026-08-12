import { ChatMessage, type ChatContext } from "@livekit/agents";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { recordCollectedField } from "./state";
import type { RealEstateCallState, RealEstateFieldDefinition } from "./types";

const MAX_INTAKE_UTTERANCES = 24;

export function appendIntakeUtterance(
  state: RealEstateCallState,
  text: string,
): RealEstateCallState {
  const trimmed = text.trim();
  if (!trimmed) return state;
  const prev = state.intakeUtterances ?? [];
  if (prev[prev.length - 1] === trimmed) return state;
  const intakeUtterances = [...prev, trimmed].slice(-MAX_INTAKE_UTTERANCES);
  return { ...state, intakeUtterances };
}

export function userUtterancesFromChatCtx(chatCtx: ChatContext): string[] {
  const lines: string[] = [];
  for (const item of chatCtx.items) {
    if (item instanceof ChatMessage && item.role === "user") {
      const text = item.textContent?.trim();
      if (text) lines.push(text);
    }
  }
  return lines;
}

export function mergeIntakeUtteranceSources(
  state: RealEstateCallState,
  chatCtx: ChatContext,
): string[] {
  const fromCtx = userUtterancesFromChatCtx(chatCtx);
  const fromState = state.intakeUtterances ?? [];
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...fromState, ...fromCtx]) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }
  return merged.slice(-MAX_INTAKE_UTTERANCES);
}

export type IntakeExtractionResult = {
  fieldId: string;
  value: string;
  source: "heuristic" | "llm";
};

function hasFinancingCue(text: string): boolean {
  return /\b(financ|pre-?approved|preapproved|lender|mortgage|cash buyer|own financing|have financing|my own financing)\b/i.test(
    text,
  );
}

function hasTimeframeCue(text: string): boolean {
  return /\b(asap|soon|this month|next month|\d+\s*months?|just researching|not sure|flexible)\b/i.test(
    text,
  );
}

/** Fast path — map obvious phrases before optional LLM extraction. */
export function heuristicIntakeExtractions(
  utterances: string[],
  candidateFields: RealEstateFieldDefinition[],
  alreadyCollected: Record<string, string>,
): IntakeExtractionResult[] {
  const allowed = new Set(candidateFields.map((f) => f.field_id));
  const text = utterances.join(" ").trim();
  if (!text) return [];

  const results: IntakeExtractionResult[] = [];
  const push = (fieldId: string, value: string) => {
    if (!allowed.has(fieldId) || alreadyCollected[fieldId]?.trim() || !value.trim()) return;
    if (results.some((r) => r.fieldId === fieldId)) return;
    results.push({ fieldId, value: value.trim(), source: "heuristic" });
  };

  const moneyMatch = text.match(
    /\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,})(?:\s*(?:k|thousand|million|m))?|\baround\s+\$?\s*[\d,.]+[kK]?\b/i,
  );
  if (moneyMatch && allowed.has("budget_or_price_range")) {
    push("budget_or_price_range", moneyMatch[0].replace(/\s+/g, " ").trim());
  }

  const typeMatch = text.match(
    /\b(townhouse|town home|single[- ]family|condo|multi-?family|duplex|land)\b/i,
  );
  if (typeMatch && allowed.has("property_type")) {
    push("property_type", typeMatch[0]);
  }

  const areaMatch = text.match(
    /\b(?:in|around|near)\s+([A-Za-z][A-Za-z\s]{2,40}?)(?:\s+area)?(?=[,.]|$|\s+(?:around|about|for|with|and))/i,
  );
  if (areaMatch?.[1] && allowed.has("target_areas")) {
    const area = areaMatch[1].trim();
    if (!/\b(buy|buying|budget|townhouse|condo|garage)\b/i.test(area)) {
      push("target_areas", area);
    }
  }

  if (/\bdale city\b/i.test(text) && allowed.has("target_areas")) {
    push("target_areas", "Dale City");
  }
  if (/\bdaly city\b/i.test(text) && allowed.has("target_areas")) {
    push("target_areas", "Daly City");
  }

  if (hasFinancingCue(text) && allowed.has("financing_status")) {
    push("financing_status", text.match(/\b(cash|financing|pre-?approved|own financing)\b/i)?.[0] || "Has financing");
  }

  if (hasTimeframeCue(text) && allowed.has("purchase_timeframe")) {
    const tf = text.match(/\b(ASAP|as soon as possible|\d+\s*months?|just researching)\b/i);
    push("purchase_timeframe", tf?.[0] || "Flexible");
  }

  const featureMatches = text.match(/\b(garage|yard|school district|basement|pool|fenced yard)\b/gi);
  if (featureMatches?.length && allowed.has("must_have_features")) {
    push("must_have_features", [...new Set(featureMatches.map((m) => m.toLowerCase()))].join(", "));
  }

  return results;
}

function parseLlmExtractionJson(raw: string): Array<{ field_id: string; value: string }> {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonBlock) as {
      fields?: Array<{ field_id?: string; value?: string }>;
    };
    if (!parsed.fields?.length) return [];
    return parsed.fields
      .filter((f) => f.field_id?.trim() && f.value?.trim())
      .map((f) => ({ field_id: f.field_id!.trim(), value: f.value!.trim() }));
  } catch {
    return [];
  }
}

export async function llmIntakeExtractions(
  utterances: string[],
  candidateFields: RealEstateFieldDefinition[],
  alreadyCollected: Record<string, string>,
): Promise<IntakeExtractionResult[]> {
  if (!utterances.length || !candidateFields.length) return [];

  const fieldGuide = candidateFields
    .map(
      (f) =>
        `${f.field_id} (${f.label}): ${f.collection_instruction}. ` +
        `Map garage/yard/amenities to must_have_features. ` +
        `Map price/$ amounts to budget_or_price_range. ` +
        `Map when they want to buy to purchase_timeframe — not financing. ` +
        `Map cash/financing/pre-approved to financing_status.`,
    )
    .join("\n");

  const system = [
    "Extract real estate intake fields from caller speech. Return ONLY valid JSON:",
    '{"fields":[{"field_id":"...","value":"..."}]}',
    "Only include fields with clear evidence in the utterances. Do not invent values.",
    "If the caller already gave a value for a field, you may repeat it only if still missing from already_collected.",
  ].join(" ");

  const user = [
    "Candidate fields:",
    fieldGuide,
    "",
    "Already collected:",
    JSON.stringify(alreadyCollected),
    "",
    "Caller utterances:",
    utterances.map((u, i) => `${i + 1}. ${u}`).join("\n"),
  ].join("\n");

  const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 600 });
  if (!raw) return [];

  const allowed = new Set(candidateFields.map((f) => f.field_id));
  return parseLlmExtractionJson(raw)
    .filter((f) => allowed.has(f.field_id) && !alreadyCollected[f.field_id]?.trim())
    .map((f) => ({ fieldId: f.field_id, value: f.value, source: "llm" as const }));
}

export async function extractIntakeFieldsFromUtterances(input: {
  utterances: string[];
  candidateFields: RealEstateFieldDefinition[];
  alreadyCollected: Record<string, string>;
}): Promise<IntakeExtractionResult[]> {
  const heuristic = heuristicIntakeExtractions(
    input.utterances,
    input.candidateFields,
    input.alreadyCollected,
  );
  const collectedAfterHeuristic = {
    ...input.alreadyCollected,
    ...Object.fromEntries(heuristic.map((h) => [h.fieldId, h.value])),
  };

  const remainingCandidates = input.candidateFields.filter(
    (f) => !collectedAfterHeuristic[f.field_id]?.trim(),
  );
  if (!remainingCandidates.length) return heuristic;

  try {
    const llm = await llmIntakeExtractions(
      input.utterances,
      remainingCandidates,
      collectedAfterHeuristic,
    );
    const seen = new Set(heuristic.map((h) => h.fieldId));
    for (const row of llm) {
      if (!seen.has(row.fieldId)) {
        heuristic.push(row);
        seen.add(row.fieldId);
      }
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        source: "intake-memory",
        event: "llm_extraction_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return heuristic;
}

function applyExtractionsToState(
  state: RealEstateCallState,
  utterances: string[],
  extractions: IntakeExtractionResult[],
): RealEstateCallState {
  let next: RealEstateCallState = { ...state, intakeUtterances: utterances };
  for (const row of extractions) {
    next = recordCollectedField(next, row.fieldId, row.value);
  }
  return next;
}

/** Fast heuristic-only backfill — safe to run on every field task onEnter. */
export function applyHeuristicIntakeBackfill(input: {
  state: RealEstateCallState;
  chatCtx: ChatContext;
  candidateFields: RealEstateFieldDefinition[];
}): RealEstateCallState {
  const utterances = mergeIntakeUtteranceSources(input.state, input.chatCtx);
  const extractions = heuristicIntakeExtractions(
    utterances,
    input.candidateFields,
    input.state.collectedFields,
  );
  return applyExtractionsToState(input.state, utterances, extractions);
}

/** Full backfill (heuristic + LLM) before intake TaskGroup starts. */
export async function backfillIntakeFromConversation(input: {
  state: RealEstateCallState;
  chatCtx: ChatContext;
  candidateFields: RealEstateFieldDefinition[];
}): Promise<RealEstateCallState> {
  const utterances = mergeIntakeUtteranceSources(input.state, input.chatCtx);
  const extractions = await extractIntakeFieldsFromUtterances({
    utterances,
    candidateFields: input.candidateFields,
    alreadyCollected: input.state.collectedFields,
  });
  return applyExtractionsToState(input.state, utterances, extractions);
}
