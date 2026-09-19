import type { PendingFunctionCall } from "./types";

/**
 * Authoritative completed delegated function call — nested response.output_item.done only.
 */
export function extractCompletedFunctionCallFromNested(
  nested: Record<string, unknown>,
  delegationId?: string | null,
): PendingFunctionCall | null {
  if (String(nested.type || "") !== "response.output_item.done") {
    return null;
  }
  const item = nested.item;
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (row.type !== "function_call") return null;

  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) {
    return null;
  }

  const callId =
    (typeof row.call_id === "string" && row.call_id.trim()) ||
    (typeof row.id === "string" && row.id.trim()) ||
    null;
  if (!callId) return null;

  const argumentsJson =
    typeof row.arguments === "string" ? row.arguments : "";

  const responseId =
    typeof nested.response_id === "string"
      ? nested.response_id
      : typeof (nested.response as Record<string, unknown> | undefined)?.id === "string"
        ? String((nested.response as Record<string, unknown>).id)
        : undefined;

  return {
    callId,
    name,
    argumentsJson,
    itemId: typeof row.id === "string" ? row.id : undefined,
    delegationId: delegationId ?? null,
    responseId,
    outputSubmitted: false,
  };
}
