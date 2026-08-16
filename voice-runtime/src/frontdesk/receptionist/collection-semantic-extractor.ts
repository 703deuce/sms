import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import { openAiChatCompletion } from "@/lib/ai/openai";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  buildSemanticSchemaExample,
  fieldGuideForSemanticExtraction,
  findPhoneField,
  isTrivialEmailUtterance,
  isTrivialPhoneUtterance,
} from "@/lib/voice/receptionist/field-manifest-runtime";
import {
  extractDeterministicFieldsFromUtterance,
  type FieldExtractionResult,
} from "./collection-field-extractor";

export type SemanticFieldPayload = Record<string, unknown> & {
  correction?: boolean;
};

function parseSemanticJson(raw: string): SemanticFieldPayload | null {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? trimmed;
  try {
    return JSON.parse(jsonBlock) as SemanticFieldPayload;
  } catch {
    return null;
  }
}

function resolvePhoneValueFromPayload(
  fieldId: string,
  payload: SemanticFieldPayload,
  callerE164?: string,
): string | undefined {
  const useCallerIdKey = `${fieldId}_use_caller_id`;
  if (payload[useCallerIdKey] === true && callerE164) {
    return tryNormalizeE164(callerE164) || callerE164;
  }

  const phoneEntry = payload[fieldId];
  if (phoneEntry && typeof phoneEntry === "object" && !Array.isArray(phoneEntry)) {
    const obj = phoneEntry as { source?: string; value?: string };
    if (obj.source === "caller_id" && callerE164) {
      return tryNormalizeE164(callerE164) || callerE164;
    }
    if (obj.value?.trim()) {
      return tryNormalizeE164(obj.value.trim()) || obj.value.trim();
    }
  }

  if (typeof phoneEntry === "string" && phoneEntry.trim()) {
    return tryNormalizeE164(phoneEntry.trim()) || phoneEntry.trim();
  }

  if (payload.phone && typeof payload.phone === "object") {
    const legacy = payload.phone as { source?: string; value?: string };
    if (legacy.source === "caller_id" && callerE164) {
      return tryNormalizeE164(callerE164) || callerE164;
    }
    if (legacy.value?.trim()) {
      return tryNormalizeE164(legacy.value.trim()) || legacy.value.trim();
    }
  }

  return undefined;
}

function mergeSemanticIntoFields(
  payload: SemanticFieldPayload,
  manifest: AgentFieldDefinition[],
  currentFields: Record<string, string>,
  callerE164?: string,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const field of manifest) {
    if (currentFields[field.id]?.trim()) continue;

    if (field.type === "phone") {
      const phoneValue = resolvePhoneValueFromPayload(field.id, payload, callerE164);
      if (phoneValue) out[field.id] = phoneValue;
      continue;
    }

    const raw = payload[field.id];
    if (typeof raw === "string" && raw.trim()) {
      out[field.id] = raw.trim();
    }
  }

  return out;
}

function isTrivialUnambiguousUtterance(
  transcript: string,
  deterministic: FieldExtractionResult,
  missingIds: string[],
): boolean {
  if (deterministic.skippedReason) return false;

  const trimmed = transcript.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const deterministicIds = Object.keys(deterministic.fields);

  if (isTrivialPhoneUtterance(trimmed)) return true;
  if (isTrivialEmailUtterance(trimmed)) return true;

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

async function llmSemanticFieldExtraction(input: {
  transcript: string;
  manifest: AgentFieldDefinition[];
  currentFields: Record<string, string>;
  callerE164?: string;
  activeFieldId?: string;
}): Promise<Record<string, string>> {
  const scopedManifest = input.manifest.filter(
    (f) => !input.currentFields[f.id]?.trim(),
  );
  if (!scopedManifest.length) return {};

  const schemaExample = buildSemanticSchemaExample(scopedManifest);
  const phoneField = findPhoneField(scopedManifest);
  const phoneNote = phoneField
    ? `For phone field "${phoneField.id}": use string value OR set "${phoneField.id}_use_caller_id":true when caller wants the number they are calling from.`
    : "";

  const system = [
    "Extract caller field values from one spoken utterance. Return ONLY valid JSON matching this shape:",
    JSON.stringify(schemaExample),
    "Only include configured field ids with clear evidence. Use null for unknown fields. Do not invent values.",
    phoneNote,
    "Extract all fields the caller provided in compound speech (vehicle make/model/year, address landmarks, issue descriptions, etc.).",
  ].join(" ");

  const user = [
    "Configured fields for this receptionist:",
    fieldGuideForSemanticExtraction(scopedManifest),
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

  const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 600 });
  if (!raw) return {};

  const payload = parseSemanticJson(raw);
  if (!payload) return {};

  return mergeSemanticIntoFields(payload, input.manifest, input.currentFields, input.callerE164);
}

/**
 * Deterministic parse first for unambiguous values; structured semantic extraction
 * from the customer's published field manifest for everything else.
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

  if (!shouldRunSemanticExtraction(transcript, deterministic, manifest, currentFields)) {
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
      correction: Boolean(deterministic.correction || payload.correction),
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
