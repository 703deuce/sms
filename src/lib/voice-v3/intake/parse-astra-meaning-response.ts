import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { DecodeCallerMeaningLogContext } from "./decode-delegated-caller-meaning";
import {
  decodeCallerMeaningFromFunctionArguments,
  decodeDelegatedCallerMeaning,
} from "./decode-delegated-caller-meaning";
import { EMIT_CALLER_MEANING_TOOL_NAME } from "./emit-caller-meaning-tool";
import { resolveVoiceV3IntakeTransport } from "./intake-transport";
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

function collectEmitCallerMeaningArgumentsFromOutput(
  output: unknown,
): string | null {
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "function_call") continue;
    if (row.name !== EMIT_CALLER_MEANING_TOOL_NAME) continue;
    if (typeof row.arguments === "string" && row.arguments.trim()) {
      return row.arguments.trim();
    }
  }
  return null;
}

function extractFunctionCallArgumentsFromItem(
  item: Record<string, unknown>,
  transportMode: "function_tool" | "output_text",
): string | null {
  if (item.type !== "function_call") return null;
  const name = item.name;
  const nameOk =
    name === EMIT_CALLER_MEANING_TOOL_NAME ||
    (transportMode === "function_tool" && (name === undefined || name === null || name === ""));
  if (!nameOk) return null;
  if (typeof item.arguments === "string" && item.arguments.trim()) {
    return item.arguments.trim();
  }
  return null;
}

export type ExtractCallerMeaningResult =
  | { transport: "function_tool"; meaning: CallerMeaning }
  | { transport: "output_text"; meaning: CallerMeaning }
  | null;

/**
 * Parse CallerMeaning from nested Live `response.event` (delegated Astra).
 */
export function extractCallerMeaningFromAstraResponseEvent(
  nestedEvent: Record<string, unknown> | undefined,
  config: VoiceV3AgentConfig,
  logCtx?: DecodeCallerMeaningLogContext,
): ExtractCallerMeaningResult {
  if (!nestedEvent) return null;
  const type = String(nestedEvent.type || "");
  const transportMode = resolveVoiceV3IntakeTransport();

  if (type === "response.function_call_arguments.done") {
    const name = nestedEvent.name;
    const nameOk =
      name === EMIT_CALLER_MEANING_TOOL_NAME ||
      (transportMode === "function_tool" && (name === undefined || name === null || name === ""));
    if (!nameOk) return null;
    if (typeof nestedEvent.arguments !== "string" || !nestedEvent.arguments.trim()) return null;
    const meaning = decodeCallerMeaningFromFunctionArguments(
      nestedEvent.arguments.trim(),
      config,
      logCtx,
    );
    return meaning ? { transport: "function_tool", meaning } : null;
  }

  if (type === "response.output_item.done") {
    const item = nestedEvent.item;
    if (item && typeof item === "object") {
      const args = extractFunctionCallArgumentsFromItem(
        item as Record<string, unknown>,
        transportMode,
      );
      if (args) {
        const meaning = decodeCallerMeaningFromFunctionArguments(args, config, logCtx);
        if (meaning) return { transport: "function_tool", meaning };
      }
    }
    return null;
  }

  if (type !== "response.completed" && type !== "response.output_text.done") {
    return null;
  }

  if (transportMode === "function_tool") {
    if (type === "response.completed") {
      const response = nestedEvent.response;
      if (response && typeof response === "object") {
        const responseObj = response as Record<string, unknown>;
        const args = collectEmitCallerMeaningArgumentsFromOutput(responseObj.output);
        if (args) {
          const meaning = decodeCallerMeaningFromFunctionArguments(args, config, logCtx);
          if (meaning) return { transport: "function_tool", meaning };
        }
      }
    }
    return null;
  }

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
  const meaning = decodeDelegatedCallerMeaning(text, config, logCtx);
  return meaning ? { transport: "output_text", meaning } : null;
}
