import { openAiChatCompletion } from "@/lib/ai/openai";
import { matchSlotFromInput } from "@/lib/voice/workflow-engine/slot-matching";
import type { AvailableSlot } from "../calendly-calendar";
import { formatSlotSpokenLabel } from "./booking-slot-turn";

export type SemanticSlotSelectionPayload = {
  slot_id?: string | null;
  ordinal?: number | null;
  reason?: string | null;
};

const VAGUE_SLOT_CUE_RE =
  /\b(first|second|third|1st|2nd|3rd|fourth|last|later|earlier|sooner|afternoon|morning|evening|after lunch|before lunch|tuesday|wednesday|thursday|friday|monday|saturday|sunday|tomorrow|that one|that time|works for me|sounds good|anything)\b/i;

export function utteranceLooksLikeSlotSelection(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  if (/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(transcript)) return true;
  return VAGUE_SLOT_CUE_RE.test(lower);
}

export function utteranceIndicatesBookingConfirmation(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  return (
    /^(yes|yeah|yep|correct|that's right|that is right|please|go ahead|book it|sure|ok|okay)\b/.test(
      lower,
    ) || /\b(yes|please book|that's correct|that is correct|book it)\b/.test(lower)
  );
}

export function utteranceIndicatesBookingRejection(transcript: string): boolean {
  const lower = transcript.trim().toLowerCase();
  if (!lower) return false;
  return /\b(no|nope|not that|different time|another time|something else|don't want)\b/.test(lower);
}

export function formatOfferedSlotsForSemantic(
  offeredSlotIds: string[],
  slotsMap: Map<string, AvailableSlot>,
  timezone: string,
): string {
  return offeredSlotIds
    .map((slotId, index) => {
      const slot = slotsMap.get(slotId);
      if (!slot) return `${index + 1}. ${slotId} (unknown time)`;
      const label = formatSlotSpokenLabel(slot, timezone);
      return `${index + 1}. ${slotId} — ${label}`;
    })
    .join("\n");
}

function parseSemanticSlotJson(raw: string): SemanticSlotSelectionPayload | null {
  const trimmed = raw.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? trimmed;
  try {
    return JSON.parse(jsonBlock) as SemanticSlotSelectionPayload;
  } catch {
    return null;
  }
}

function resolveOrdinalSelection(
  ordinal: number,
  offeredSlotIds: string[],
): string | null {
  if (ordinal < 1 || ordinal > offeredSlotIds.length) return null;
  return offeredSlotIds[ordinal - 1] ?? null;
}

/** Fast deterministic match — ordinals, clock times, exact labels. */
export function matchOfferedSlotDeterministic(
  transcript: string,
  offeredSlotIds: string[],
  slotsMap: Map<string, AvailableSlot>,
  timezone: string,
): AvailableSlot | null {
  if (!transcript.trim() || offeredSlotIds.length === 0) return null;

  const isoStarts = offeredSlotIds
    .map((id) => slotsMap.get(id)?.startTime.toISOString())
    .filter((s): s is string => Boolean(s));

  const matchedIso = matchSlotFromInput(transcript, isoStarts, timezone);
  if (matchedIso) {
    const byIso = offeredSlotIds.find(
      (id) => slotsMap.get(id)?.startTime.toISOString() === matchedIso,
    );
    if (byIso) return slotsMap.get(byIso) ?? null;
  }

  const lower = transcript.trim().toLowerCase();
  if (/\b(later|latest|last)\b/.test(lower) && offeredSlotIds.length > 0) {
    const lastId = offeredSlotIds[offeredSlotIds.length - 1]!;
    return slotsMap.get(lastId) ?? null;
  }
  if (/\b(earlier|sooner|first)\b/.test(lower) && offeredSlotIds.length > 0) {
    return slotsMap.get(offeredSlotIds[0]!) ?? null;
  }

  for (const slotId of offeredSlotIds) {
    if (lower.includes(slotId.toLowerCase())) {
      return slotsMap.get(slotId) ?? null;
    }
  }

  for (const slotId of offeredSlotIds) {
    const slot = slotsMap.get(slotId);
    if (!slot) continue;
    const label = formatSlotSpokenLabel(slot, timezone).toLowerCase();
    if (lower.includes(label) || label.includes(lower)) return slot;
  }

  return null;
}

async function llmSemanticSlotSelection(input: {
  transcript: string;
  offeredSlotIds: string[];
  slotsMap: Map<string, AvailableSlot>;
  timezone: string;
}): Promise<string | null> {
  const offeredText = formatOfferedSlotsForSemantic(
    input.offeredSlotIds,
    input.slotsMap,
    input.timezone,
  );

  const system = [
    "Interpret which offered appointment slot the caller chose. Return ONLY valid JSON:",
    '{"slot_id":"ST_...","ordinal":null,"reason":null}',
    "slot_id MUST be one of the offered slot ids exactly. Use ordinal (1-based) only if slot_id is unclear.",
    "Map vague phrases: later/latest/last = last offered slot; earlier/first = first; afternoon = PM slot on matching day.",
    "If nothing matches, return slot_id null and a short reason.",
  ].join(" ");

  const user = [
    "Offered slots:",
    offeredText,
    "",
    "Caller utterance:",
    input.transcript,
  ].join("\n");

  const raw = await openAiChatCompletion(system, user, { temperature: 0.1, maxTokens: 200 });
  if (!raw) return null;

  const payload = parseSemanticSlotJson(raw);
  if (!payload) return null;

  if (payload.slot_id?.trim()) {
    const id = payload.slot_id.trim();
    if (input.offeredSlotIds.includes(id)) return id;
  }

  if (payload.ordinal != null && Number.isFinite(payload.ordinal)) {
    return resolveOrdinalSelection(Math.round(payload.ordinal), input.offeredSlotIds);
  }

  return null;
}

export type SlotResolutionSource = "deterministic" | "semantic_llm" | "none";

/**
 * Deterministic slot match first; structured LLM interpretation for vague selections.
 * Runtime always validates slot_id is in offeredSlotIds before state transition.
 */
export async function resolveOfferedSlotFromUtterance(
  transcript: string,
  offeredSlotIds: string[],
  slotsMap: Map<string, AvailableSlot>,
  timezone: string,
  context?: { callId?: string },
): Promise<{ slot: AvailableSlot | null; source: SlotResolutionSource }> {
  const deterministic = matchOfferedSlotDeterministic(
    transcript,
    offeredSlotIds,
    slotsMap,
    timezone,
  );
  if (deterministic && offeredSlotIds.includes(deterministic.slotId)) {
    return { slot: deterministic, source: "deterministic" };
  }

  if (!utteranceLooksLikeSlotSelection(transcript)) {
    return { slot: null, source: "none" };
  }

  try {
    const semanticId = await llmSemanticSlotSelection({
      transcript,
      offeredSlotIds,
      slotsMap,
      timezone,
    });
    if (semanticId && offeredSlotIds.includes(semanticId)) {
      const slot = slotsMap.get(semanticId);
      if (slot) return { slot, source: "semantic_llm" };
    }
  } catch (err) {
    console.warn(
      JSON.stringify({
        source: "booking-slot-semantic",
        event: "semantic_slot_selection_failed",
        callId: context?.callId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return { slot: null, source: "none" };
}

/** Unit-test helper — parse slot JSON without network. */
export function parseSemanticSlotPayloadForTest(raw: string): SemanticSlotSelectionPayload | null {
  return parseSemanticSlotJson(raw);
}

export function resolveOrdinalSlotForTest(ordinal: number, offered: string[]): string | null {
  return resolveOrdinalSelection(ordinal, offered);
}
