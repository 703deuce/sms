/**
 * Structured Voice V3 pipeline logging — one prefix for Coolify grep: VOICE_V3_PIPELINE
 *
 * Env:
 * - VOICE_V3_PIPELINE_LOG=off | normal (default) | verbose
 * - normal: lifecycle + meaningful Astra events (no argument deltas)
 * - verbose: every sideband + nested event, truncated payloads
 */

export type VoiceV3PipelineStage =
  | "pstn"
  | "webhook"
  | "runtime"
  | "sideband"
  | "astra"
  | "meaning"
  | "rules"
  | "calendar"
  | "live_out";

export type VoiceV3PipelineLogLevel = "off" | "normal" | "verbose";

export function voiceV3PipelineLogLevel(): VoiceV3PipelineLogLevel {
  const raw = process.env.VOICE_V3_PIPELINE_LOG?.trim().toLowerCase();
  if (raw === "0" || raw === "off" || raw === "false") return "off";
  if (raw === "verbose" || raw === "debug" || raw === "2") return "verbose";
  return "normal";
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const E164_RE = /\+[1-9]\d{6,14}/g;

export function redactVoiceV3PipelineString(value: string, maxLen = 240): string {
  let s = value.replace(EMAIL_RE, "[email]").replace(E164_RE, "[phone]");
  if (s.length > maxLen) {
    return `${s.slice(0, maxLen)}…(${s.length} chars)`;
  }
  return s;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[max_depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactVoiceV3PipelineString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 24).map((v) => redactValue(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "arguments" && typeof v === "string") {
        out.arguments_bytes = v.length;
        out.arguments_preview = redactVoiceV3PipelineString(v, 120);
        continue;
      }
      out[k] = redactValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function logVoiceV3Pipeline(
  stage: VoiceV3PipelineStage,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  if (voiceV3PipelineLogLevel() === "off") return;
  console.log(
    "VOICE_V3_PIPELINE",
    redactValue({
      stage,
      event,
      at: new Date().toISOString(),
      ...fields,
    }) as Record<string, unknown>,
  );
}

export function shouldLogAstraNestedType(nestedType: string): boolean {
  if (voiceV3PipelineLogLevel() === "verbose") return true;
  if (!nestedType) return true;
  if (nestedType.includes(".delta")) return false;
  return true;
}

/** Compact, redacted summary for nested Live `response.event` payloads. */
export function summarizeAstraNestedEvent(nested: Record<string, unknown>): Record<string, unknown> {
  const nestedType = String(nested.type || "");
  const summary: Record<string, unknown> = { nested_type: nestedType };

  const responseId =
    (typeof nested.response_id === "string" && nested.response_id) ||
    (nested.response &&
      typeof nested.response === "object" &&
      typeof (nested.response as Record<string, unknown>).id === "string" &&
      (nested.response as Record<string, unknown>).id) ||
    (nested.item &&
      typeof nested.item === "object" &&
      typeof (nested.item as Record<string, unknown>).response_id === "string" &&
      (nested.item as Record<string, unknown>).response_id);

  if (responseId) summary.response_id = responseId;

  if (nestedType === "response.function_call_arguments.done") {
    summary.name = nested.name;
    if (typeof nested.arguments === "string") {
      summary.arguments_bytes = nested.arguments.length;
    }
  }

  if (nestedType === "response.output_item.done" && nested.item && typeof nested.item === "object") {
    const item = nested.item as Record<string, unknown>;
    summary.item_type = item.type;
    summary.item_id = item.id;
    summary.item_name = item.name;
    if (typeof item.arguments === "string") {
      summary.item_arguments_bytes = item.arguments.length;
    }
  }

  if (nestedType === "response.failed") {
    summary.error = nested.error ?? nested.message;
  }

  if (voiceV3PipelineLogLevel() === "verbose") {
    summary.nested = redactValue(nested);
  }

  return summary;
}

export function logVoiceV3SidebandOutbound(input: {
  liveSessionId: string;
  event: Record<string, unknown>;
}): void {
  if (voiceV3PipelineLogLevel() === "off") return;
  logVoiceV3Pipeline("live_out", String(input.event.type || "unknown"), {
    live_session_id: input.liveSessionId,
    event_id: input.event.event_id ?? null,
    payload: redactValue(input.event),
  });
}
