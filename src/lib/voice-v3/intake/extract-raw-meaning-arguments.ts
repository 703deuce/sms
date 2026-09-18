import { EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";

/** Raw emit_caller_meaning arguments JSON from a nested Live response event, if present. */
export function extractRawMeaningArgumentsFromNested(
  nested: Record<string, unknown>,
): string | null {
  const type = String(nested.type || "");
  if (type === "response.function_call_arguments.done") {
    if (typeof nested.arguments === "string" && nested.arguments.trim()) {
      return nested.arguments.trim();
    }
    return null;
  }
  if (type === "response.output_item.done") {
    const item = nested.item;
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (row.type !== "function_call") return null;
    if (row.name && row.name !== EMIT_CALLER_MEANING_TOOL_NAME) return null;
    if (typeof row.arguments === "string" && row.arguments.trim()) {
      return row.arguments.trim();
    }
  }
  return null;
}
