import { ChatMessage, type ChatContext } from "@livekit/agents";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { AgentFieldDefinition } from "./types";
import { validateReceptionistFieldValue } from "./field-validation";

const MAX_UTTERANCES = 24;

const PHONE_IN_TEXT =
  /\b(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/;

const EMAIL_IN_TEXT = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;

const NAME_LINE =
  /^(?:i'm|i am|my name is|this is)\s+([A-Za-z][A-Za-z' -]{1,48})$/i;

const SHORT_ACK =
  /^(hi|hello|hey|yes|yeah|yep|sure|okay|ok|thanks|thank you|no problem|correct|that's right|that is right)\b/i;

const ADDRESS_PREFIX =
  /^(?:my address is|the address is|address is|i live at|i'm at|im at|we're at|we are at|located at|service address is)\s+/i;

const STREET_LIKE = /\b\d{1,6}\s+[A-Za-z]/;

const LOCATION_ONLY =
  /^(?:i'm|i am|we're|we are)\s+(?:in|at|on|near|by)\s+[A-Za-z]/i;

export function userUtterancesFromChatCtx(chatCtx: ChatContext): string[] {
  const lines: string[] = [];
  for (const item of chatCtx.items) {
    if (item instanceof ChatMessage && item.role === "user") {
      const text = item.textContent?.trim();
      if (text) lines.push(text);
    }
  }
  return lines.slice(-MAX_UTTERANCES);
}

function manifestIds(manifest: AgentFieldDefinition[]): Set<string> {
  return new Set(manifest.map((f) => f.id));
}

function looksLikeCollectedName(line: string): boolean {
  const trimmed = line.trim().replace(/[.,!?]+$/, "");
  if (PHONE_IN_TEXT.test(trimmed) || EMAIL_IN_TEXT.test(trimmed)) return false;
  const named = trimmed.match(NAME_LINE);
  if (named?.[1]) {
    const candidate = named[1].trim();
    if (/^\b(in|at|near|from|on)\b/i.test(candidate)) return false;
    if (candidate.split(/\s+/).length > 4) return false;
    return true;
  }
  const words = trimmed.split(/\s+/);
  if (words.length === 2 && /^[A-Z][a-z]+ [A-Z][A-Za-z' -]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Industry-agnostic: caller freeform statement (problem, request, question) —
 * not identity, contact info, short ack, or location-only fragment.
 */
export function looksLikeFreeformCallerStatement(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 12) return false;
  if (SHORT_ACK.test(trimmed)) return false;
  if (looksLikeCollectedName(trimmed)) return false;
  if (PHONE_IN_TEXT.test(trimmed)) return false;
  if (EMAIL_IN_TEXT.test(trimmed)) return false;
  if (LOCATION_ONLY.test(trimmed) && trimmed.length < 40) return false;
  return true;
}

function looksLikeAddressUtterance(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 8) return false;
  if (ADDRESS_PREFIX.test(trimmed)) return true;
  if (STREET_LIKE.test(trimmed) && trimmed.length >= 10) return true;
  if (LOCATION_ONLY.test(trimmed)) return true;
  return false;
}

/**
 * Fast heuristic extraction from caller utterances — no LLM round-trip.
 * Uses field types and generic speech patterns only (no industry vocabulary).
 */
export function heuristicReceptionistFieldBackfill(
  utterances: string[],
  manifest: AgentFieldDefinition[],
  alreadyCollected: Record<string, string>,
): Record<string, string> {
  const allowed = manifestIds(manifest);
  if (!utterances.length) return {};

  const out: Record<string, string> = {};
  const push = (id: string, value: string) => {
    if (!allowed.has(id) || alreadyCollected[id]?.trim() || out[id]?.trim()) return;
    const field = manifest.find((f) => f.id === id);
    if (!field) return;
    try {
      out[id] = validateReceptionistFieldValue(field, value);
    } catch {
      // Skip values that fail validation — collection task can re-ask.
    }
  };

  if (allowed.has("phone") && !alreadyCollected.phone?.trim()) {
    for (const line of utterances) {
      const match = line.match(PHONE_IN_TEXT);
      if (!match) continue;
      const raw = match[0];
      if (tryNormalizeE164(raw)) {
        push("phone", raw);
        break;
      }
    }
  }

  if (allowed.has("email") && !alreadyCollected.email?.trim()) {
    for (const line of utterances) {
      const match = line.match(EMAIL_IN_TEXT);
      if (match) {
        push("email", match[0]);
        break;
      }
    }
  }

  if (allowed.has("name") && !alreadyCollected.name?.trim()) {
    for (const line of utterances) {
      const trimmed = line.trim().replace(/[.,!?]+$/, "");
      if (PHONE_IN_TEXT.test(trimmed) || EMAIL_IN_TEXT.test(trimmed)) continue;
      if (looksLikeFreeformCallerStatement(trimmed) && trimmed.length > 24) continue;
      const named = trimmed.match(NAME_LINE);
      if (named?.[1]) {
        const candidate = named[1].trim();
        if (!/^\b(in|at|near|from|on)\b/i.test(candidate)) {
          push("name", candidate);
          break;
        }
      }
      if (looksLikeCollectedName(trimmed)) {
        push("name", trimmed);
        break;
      }
    }
  }

  if (allowed.has("reason") && !alreadyCollected.reason?.trim()) {
    for (const line of utterances) {
      if (!looksLikeFreeformCallerStatement(line)) continue;
      push("reason", line.trim());
      break;
    }
  }

  if (allowed.has("address") && !alreadyCollected.address?.trim()) {
    for (const line of utterances) {
      if (!looksLikeAddressUtterance(line)) continue;
      push("address", line.trim());
      break;
    }
  }

  return out;
}

export function applyReceptionistFieldBackfill(input: {
  chatCtx: ChatContext;
  manifest: AgentFieldDefinition[];
  receptionistFields: Record<string, string>;
}): Record<string, string> {
  const utterances = userUtterancesFromChatCtx(input.chatCtx);
  const backfill = heuristicReceptionistFieldBackfill(
    utterances,
    input.manifest,
    input.receptionistFields,
  );
  return { ...input.receptionistFields, ...backfill };
}
