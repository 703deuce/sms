import type { ChatContext } from "@livekit/agents";
import type { AgentFieldDefinition } from "./types";
import { missingReceptionistFields, type ReceptionistCollectionPurpose } from "./field-collection-scope";

/** Keep enough caller turns for a full booking call (not just the last few seconds). */
export const CONVERSATION_RECAP_MAX_UTTERANCES = 64;

function userTextFromChatItem(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const role = (item as { role?: unknown }).role;
  if (role !== "user") return null;
  const text = (item as { textContent?: unknown }).textContent;
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  return trimmed || null;
}

export function callerUtterancesFromChatCtx(
  chatCtx: ChatContext,
  max = CONVERSATION_RECAP_MAX_UTTERANCES,
): string[] {
  const lines: string[] = [];
  for (const item of chatCtx.items) {
    const text = userTextFromChatItem(item);
    if (text) lines.push(text);
  }
  return lines.slice(-max);
}

function formatFieldsSummary(fields: Record<string, string> | undefined): string {
  if (!fields) return "";
  return Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([id, v]) => `${id}=${v.trim()}`)
    .join(", ");
}

export function formatReceptionistFieldsSummary(
  fields: Record<string, string> | undefined,
): string {
  return formatFieldsSummary(fields);
}

/**
 * Authoritative recap for parent agent after task handoffs — full caller thread + saved state.
 */
export function buildReceptionistConversationRecap(input: {
  chatCtx: ChatContext;
  receptionistFields?: Record<string, string>;
  fieldManifest?: AgentFieldDefinition[];
  purpose?: ReceptionistCollectionPurpose;
}): string {
  const utterances = callerUtterancesFromChatCtx(input.chatCtx);
  const saved = formatFieldsSummary(input.receptionistFields);
  const missing =
    input.fieldManifest?.length
      ? missingReceptionistFields(
          input.fieldManifest,
          input.receptionistFields,
          input.purpose ?? "general",
        ).map((f) => f.id)
      : [];

  const parts = [
    "Authoritative conversation state (trust this over memory gaps):",
    utterances.length
      ? `Caller statements this call: ${utterances.join(" · ")}`
      : "Caller statements this call: (none transcribed yet)",
    saved ? `Saved in runtime: ${saved}` : "Saved in runtime: (none yet)",
    missing.length ? `Still missing for flow: ${missing.join(", ")}` : "Required fields: complete for current flow",
    "Do not re-ask for saved fields. Ask one new question only if something is still missing.",
  ];
  return parts.join("\n");
}
