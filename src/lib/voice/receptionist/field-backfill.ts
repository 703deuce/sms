import type { ChatContext } from "@livekit/agents";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { AgentFieldDefinition } from "./types";
import { validateReceptionistFieldValue } from "./field-validation";
import {
  isAddressField,
  isEmailField,
  isPhoneField,
  looksLikeNameField,
} from "./field-manifest-runtime";
import {
  callerUtterancesFromChatCtx,
  CONVERSATION_RECAP_MAX_UTTERANCES,
} from "./conversation-recap";

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
  return callerUtterancesFromChatCtx(chatCtx, CONVERSATION_RECAP_MAX_UTTERANCES);
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
 * Fast heuristic extraction — driven by manifest field types, not fixed field ids.
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

  for (const field of manifest) {
    if (alreadyCollected[field.id]?.trim()) continue;

    if (isPhoneField(field)) {
      for (const line of utterances) {
        const match = line.match(PHONE_IN_TEXT);
        if (!match) continue;
        const raw = match[0];
        if (tryNormalizeE164(raw)) {
          push(field.id, raw);
          break;
        }
      }
      continue;
    }

    if (isEmailField(field)) {
      for (const line of utterances) {
        const match = line.match(EMAIL_IN_TEXT);
        if (match) {
          push(field.id, match[0]);
          break;
        }
      }
      continue;
    }

    if (isAddressField(field)) {
      for (const line of utterances) {
        if (!looksLikeAddressUtterance(line)) continue;
        push(field.id, line.trim());
        break;
      }
      continue;
    }

    if (looksLikeNameField(field)) {
      for (const line of utterances) {
        const trimmed = line.trim().replace(/[.,!?]+$/, "");
        if (PHONE_IN_TEXT.test(trimmed) || EMAIL_IN_TEXT.test(trimmed)) continue;
        if (looksLikeFreeformCallerStatement(trimmed) && trimmed.length > 24) continue;
        const named = trimmed.match(NAME_LINE);
        if (named?.[1]) {
          const candidate = named[1].trim();
          if (!/^\b(in|at|near|from|on)\b/i.test(candidate)) {
            push(field.id, candidate);
            break;
          }
        }
        if (looksLikeCollectedName(trimmed)) {
          push(field.id, trimmed);
          break;
        }
      }
    }
  }

  return out;
}

export function applyReceptionistFieldBackfill(input: {
  chatCtx: ChatContext;
  manifest: AgentFieldDefinition[];
  receptionistFields: Record<string, string>;
  authoritativeFieldIds?: string[];
}): Record<string, string> {
  const utterances = userUtterancesFromChatCtx(input.chatCtx);
  const locked = new Set(input.authoritativeFieldIds ?? []);
  const receptionistFields = { ...input.receptionistFields };
  for (const fieldId of locked) {
    const value = input.receptionistFields[fieldId]?.trim();
    if (value) receptionistFields[fieldId] = value;
  }
  const backfill = heuristicReceptionistFieldBackfill(
    utterances,
    input.manifest,
    receptionistFields,
  );
  const merged = { ...receptionistFields, ...backfill };
  for (const fieldId of locked) {
    const authoritative = input.receptionistFields[fieldId]?.trim();
    if (authoritative) merged[fieldId] = authoritative;
  }
  return merged;
}
