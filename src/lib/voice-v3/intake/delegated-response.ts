import { parseVoiceV3IntakeExtraction, type VoiceV3IntakeExtraction } from "./extraction-schema";

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

/**
 * Parse structured intake JSON from nested Live `response.event` payloads.
 * Returns null when the event is not a completed structured extraction.
 */
export function extractIntakeFromAstraResponseEvent(
  nestedEvent: Record<string, unknown> | undefined,
): VoiceV3IntakeExtraction | null {
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
    const parsed = parseVoiceV3IntakeExtraction(raw);
    if (
      !parsed.field_updates.length &&
      parsed.caller_intent == null &&
      parsed.notes_for_planner == null
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
