import { ChatMessage, type ChatContext } from "@livekit/agents";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { AgentFieldDefinition } from "./types";
import { validateReceptionistFieldValue } from "./field-validation";

const MAX_UTTERANCES = 24;

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

const HVAC_ISSUE =
  /\b(furnace|heater|boiler|thermostat|a\/c|ac\b|air conditioning|heat pump|not heating|isn't heating|isnt heating|went out|stopped working|not working|isn't working|isnt working|no heat|no-heat|no cool|no-cool|isn't cooling|isnt cooling|not cooling|weak airflow|strange noise|maintenance|hvac|repair|service call|emergency)\b/i;

const PROBLEM_PHRASE =
  /\b(problem|issue|broken|leak|outage|won't|wont|can't|cant|need someone|come out|callback|appointment|schedule)\b/i;

const SERVICE_AREA =
  /\b(arlington|fairfax|falls church|mclean|woodbridge|dale city|virginia|va)\b/i;

const PHONE_IN_TEXT =
  /\b(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/;

const NAME_LINE =
  /^(?:i'm|i am|my name is|this is)\s+([A-Za-z][A-Za-z' -]{1,48})$/i;

function looksLikeCollectedName(line: string): boolean {
  const trimmed = line.trim().replace(/[.,!?]+$/, "");
  if (HVAC_ISSUE.test(trimmed) || PHONE_IN_TEXT.test(trimmed)) return false;
  const named = trimmed.match(NAME_LINE);
  if (named?.[1]) {
    const candidate = named[1].trim();
    if (!/\b(in|at|near|from)\b/i.test(candidate) && !SERVICE_AREA.test(candidate)) {
      return true;
    }
  }
  return /^[A-Z][a-z]+ [A-Z][A-Za-z' -]+$/.test(trimmed);
}

function looksLikeReasonUtterance(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 10) return false;
  if (looksLikeCollectedName(trimmed)) return false;
  if (PHONE_IN_TEXT.test(trimmed)) return false;
  if (/^(hi|hello|hey|yes|yeah|yep|sure|okay|ok|thanks|thank you)\b/i.test(trimmed)) {
    return false;
  }
  if (SERVICE_AREA.test(trimmed) && !HVAC_ISSUE.test(trimmed) && trimmed.length < 48) {
    return false;
  }
  return HVAC_ISSUE.test(trimmed) || PROBLEM_PHRASE.test(trimmed) || trimmed.length >= 18;
}

function manifestIds(manifest: AgentFieldDefinition[]): Set<string> {
  return new Set(manifest.map((f) => f.id));
}

/**
 * Fast heuristic extraction from caller utterances — no LLM round-trip.
 */
export function heuristicReceptionistFieldBackfill(
  utterances: string[],
  manifest: AgentFieldDefinition[],
  alreadyCollected: Record<string, string>,
): Record<string, string> {
  const allowed = manifestIds(manifest);
  const text = utterances.join(" ").trim();
  if (!text) return {};

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

  if (allowed.has("reason") && !alreadyCollected.reason?.trim()) {
    const issueLine = utterances.find((u) => HVAC_ISSUE.test(u) || PROBLEM_PHRASE.test(u));
    if (issueLine) {
      push("reason", issueLine.trim());
    } else {
      const fallback = utterances.find((u) => looksLikeReasonUtterance(u));
      if (fallback) push("reason", fallback.trim());
    }
  }

  if (allowed.has("address") && !alreadyCollected.address?.trim()) {
    const addressLine = utterances.find(
      (u) => SERVICE_AREA.test(u) && /\b(in|at|live|located)\b/i.test(u),
    );
    if (addressLine) {
      push("address", addressLine.trim());
    } else {
      const areaMatch = text.match(SERVICE_AREA);
      if (areaMatch) {
        const line = utterances.find((u) => SERVICE_AREA.test(u));
        if (line) push("address", line.trim());
      }
    }
  }

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

  if (allowed.has("name") && !alreadyCollected.name?.trim()) {
    for (const line of utterances) {
      const trimmed = line.trim().replace(/[.,!?]+$/, "");
      if (HVAC_ISSUE.test(trimmed) || PHONE_IN_TEXT.test(trimmed)) continue;
      const named = trimmed.match(NAME_LINE);
      if (named?.[1]) {
        const candidate = named[1].trim();
        if (!/\b(in|at|near|from)\b/i.test(candidate) && !SERVICE_AREA.test(candidate)) {
          push("name", candidate);
          break;
        }
      }
      const words = trimmed.split(/\s+/);
      if (
        words.length === 2 &&
        /^[A-Z][a-z]+ [A-Z][A-Za-z' -]+$/.test(trimmed)
      ) {
        push("name", trimmed);
        break;
      }
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
