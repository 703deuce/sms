import { parseCallerMeaning, safeParseCallerMeaning, type CallerMeaning } from "./caller-meaning-schema";

function collectOutputTextFromResponse(response: Record<string, unknown>): string {
  const direct = response.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const output = response.output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "message") continue;
    const content = row.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as Record<string, unknown>;
      if (p.type === "output_text" && typeof p.text === "string") {
        parts.push(p.text);
      }
    }
  }
  return parts.join("").trim();
}

function meaningHasSignal(meaning: CallerMeaning): boolean {
  return (
    meaning.captured_fields.length > 0 ||
    meaning.corrections.length > 0 ||
    meaning.active_goal !== "UNKNOWN" ||
    Boolean(
      meaning.scheduling.requested_date_expression ||
        meaning.scheduling.requested_time_expression ||
        meaning.scheduling.requested_daypart,
    ) ||
    meaning.ambiguities.length > 0
  );
}

/**
 * Parse strict CallerMeaning from nested Live `response.event` (delegated Astra).
 */
export function extractCallerMeaningFromAstraResponseEvent(
  nestedEvent: Record<string, unknown> | undefined,
): CallerMeaning | null {
  if (!nestedEvent) return null;
  const type = String(nestedEvent.type || "");

  let text = "";
  if (type === "response.completed") {
    const response = nestedEvent.response;
    if (response && typeof response === "object") {
      text = collectOutputTextFromResponse(response as Record<string, unknown>);
    }
  } else if (type === "response.output_text.done") {
    if (typeof nestedEvent.text === "string") text = nestedEvent.text.trim();
  }

  if (!text) return null;

  try {
    const raw = JSON.parse(text) as unknown;
    const parsed = safeParseCallerMeaning(raw);
    if (!parsed.ok) return null;
    if (!meaningHasSignal(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** For direct Responses API integration tests. */
export function parseCallerMeaningFromOutputText(text: string): CallerMeaning | null {
  try {
    const raw = JSON.parse(text) as unknown;
    const parsed = parseCallerMeaning(raw);
    return meaningHasSignal(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
