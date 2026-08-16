import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  extractDeterministicFieldsFromUtterance,
  type FieldExtractionResult,
} from "./collection-field-extractor";

export type SemanticPhoneValue = { source: "caller_id" } | { value: string };

export type SemanticFieldPayload = {
  name?: string | null;
  phone?: SemanticPhoneValue | string | null;
  address?: string | null;
  reason?: string | null;
  email?: string | null;
  correction?: boolean;
};

function isTrivialUnambiguousUtterance(
  transcript: string,
  deterministic: FieldExtractionResult,
  missingIds: string[],
): boolean {
  if (deterministic.skippedReason) return false;

  const trimmed = transcript.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const deterministicIds = Object.keys(deterministic.fields);

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (
    digitsOnly.length >= 10 &&
    digitsOnly.length <= 11 &&
    deterministicIds.length <= 1 &&
    (deterministicIds.length === 0 || deterministicIds[0] === "phone")
  ) {
    return true;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(trimmed) && deterministicIds.includes("email")) {
    return true;
  }

  if (
    missingIds.length === 1 &&
    deterministicIds.length === 1 &&
    missingIds[0] === deterministicIds[0] &&
    words <= 4 &&
    !deterministic.correction
  ) {
    return true;
  }

  return false;
}

function shouldRunSemanticExtraction(
  transcript: string,
  deterministic: FieldExtractionResult,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
): boolean {
  if (deterministic.skippedReason) return false;

  const missingIds = manifest
    .filter((f) => f.required && !currentFields[f.id]?.trim())
    .map((f) => f.id);
  if (!missingIds.length) return false;

  if (isTrivialUnambiguousUtterance(transcript, deterministic, missingIds)) {
    return false;
  }

  const unresolved = missingIds.filter((id) => !deterministic.fields[id]?.trim());
  return unresolved.length > 0;
}

function parseSemanticJson(raw: string): SemanticFieldPayload | null {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? trimmed;
  try {
    return JSON.parse(jsonBlock) as SemanticFieldPayload;
  } catch {
    return null;
  }
}

function resolvePhoneFromSemantic(
  phone: SemanticPhoneValue | string | null | undefined,
  callerE164?: string,
): string | undefined {
  if (!phone) return undefined;
  if (typeof phone === "string") {
    const normalized = tryNormalizeE164(phone.trim());
    return normalized || phone.trim();
  }
  if (phone.source === "caller_id" && callerE164) {
    return tryNormalizeE164(callerE164) || callerE164;
  }
  return undefined;
}

function mergeSemanticIntoFields(
  payload: SemanticFieldPayload,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
  callerE164?: string,
): Record<string, string> {
  const allowed = new Set(manifest.map((f) => f.id));
  const out: Record<string, string> = {};

  const assign = (fieldId: string, raw: string | null | undefined) => {
    if (!raw?.trim() || !allowed.has(fieldId)) return;
    if (currentFields[fieldId]?.trim()) return;
    out[fieldId] = raw.trim();
  };

  assign("name", payload.name);
  assign("address", payload.address);
  assign("reason", payload.reason);
  assign("email", payload.email);

  const phoneValue = resolvePhoneFromSemantic(payload.phone, callerE164);
  if (phoneValue && allowed.has("phone") && !currentFields.phone?.trim()) {
    out.phone = phoneValue;
  }

  return out;
}

async function llmSemanticFieldExtraction(input: {
  transcript: string;
  manifest: AgentFieldDefinition[];
  currentFields: Record<string, string>;
  callerE164?: string;
  activeFieldId?: string;
}): Promise<Record<string, string>> {
  const missing = input.manifest.filter(
    (f) => f.required && !input.currentFields[f.id]?.trim(),
  );
  if (!missing.length) return {};

  const fieldGuide = input.manifest
    .map(
      (f) =>
        `${f.id} (${f.label}, required=${f.required}): ${f.question || f.label}. ` +
        `Type: ${f.type || "text"}.`,
    )
    .join("\n");

  const system = [
    "Extract caller intake fields from one spoken utterance. Return ONLY valid JSON:",
    '{"name":null,"phone":null,"address":null,"reason":null,"email":null,"correction":false}',
    "phone may be a string OR {\"source\":\"caller_id\"} when they want to use the number they are calling from.",
    "Only include fields with clear evidence. Use null for unknown fields. Do not invent values.",
    "reason = service issue / problem description (include upstairs/downstairs, since last night, quit cooling).",
    "address = service location even if partial (highway, route, near landmark, city area).",
    "Compound utterances often include name + phone intent + address + reason in one breath — extract all supported fields.",
  ].join(" ");

  const user = [
    "Fields:",
    fieldGuide,
    "",
    "Already collected:",
    JSON.stringify(input.currentFields),
    "",
    input.callerE164 ? `Caller ANI available: ${input.callerE164}` : "Caller ANI: unknown",
    input.activeFieldId ? `Active question field: ${input.activeFieldId}` : "",
    "",
    "Caller utterance:",
    input.transcript,
  ].join("\n");

  const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 400 });
  if (!raw) return {};

  const payload = parseSemanticJson(raw);
  if (!payload) return {};

  return mergeSemanticIntoFields(
    payload,
    input.manifest,
    input.currentFields,
    input.callerE164,
  );
}

/**
 * Deterministic extraction first; structured LLM semantic extraction for compound speech.
 * Runtime validates every value before authoritative save.
 */
export async function extractFieldsFromUtterance(
  transcript: string,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
  context?: {
    callerE164?: string;
    activeFieldId?: string;
    callId?: string;
  },
): Promise<FieldExtractionResult> {
  const deterministic = extractDeterministicFieldsFromUtterance(
    transcript,
    manifest,
    currentFields,
    context?.callerE164,
  );

  if (
    !shouldRunSemanticExtraction(transcript, deterministic, manifest, currentFields)
  ) {
    return deterministic;
  }

  try {
    const semantic = await llmSemanticFieldExtraction({
      transcript,
      manifest,
      currentFields,
      callerE164: context?.callerE164,
      activeFieldId: context?.activeFieldId,
    });

    const merged = { ...deterministic.fields };
    for (const [fieldId, value] of Object.entries(semantic)) {
      if (!merged[fieldId]?.trim() && value?.trim()) {
        merged[fieldId] = value.trim();
      }
    }

    return {
      fields: merged,
      correction: deterministic.correction,
      extractionSource: Object.keys(semantic).length > 0 ? "semantic_llm" : "deterministic",
    };
  } catch (err) {
    console.warn(
      JSON.stringify({
        source: "collection-semantic-extractor",
        event: "semantic_extraction_failed",
        callId: context?.callId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return deterministic;
  }
}

/** Unit-test helper — parse LLM JSON without network. */
export function parseSemanticFieldPayloadForTest(raw: string): SemanticFieldPayload | null {
  return parseSemanticJson(raw);
}

export function mergeSemanticFieldsForTest(
  payload: SemanticFieldPayload,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
  callerE164?: string,
): Record<string, string> {
  return mergeSemanticIntoFields(payload, manifest, currentFields, callerE164);
}
