import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { DecodeCallerMeaningLogContext } from "./decode-delegated-caller-meaning";
import { decodeDelegatedCallerMeaning } from "./decode-delegated-caller-meaning";
import type { CallerMeaning } from "./caller-meaning-schema";

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
 * Parse strict CallerMeaning from nested Live `response.event` (delegated Astra).
 */
export function extractCallerMeaningFromAstraResponseEvent(
  nestedEvent: Record<string, unknown> | undefined,
  config: VoiceV3AgentConfig,
  logCtx?: DecodeCallerMeaningLogContext,
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
  return decodeDelegatedCallerMeaning(text, config, logCtx);
}
