/**
 * End-to-end MCTB pipeline console tracing.
 *
 * Prints structured JSON to stdout so production logs show every decision,
 * skip reason, phone normalization, and job handoff in one grep-friendly stream.
 *
 * On by default. Set MCTB_PIPELINE_TRACE=0 to disable.
 * Set MCTB_PIPELINE_TRACE=verbose for full raw TeXML field dumps.
 */

import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";

export type MctbPipelineLayer =
  | "texml-status"
  | "mctb-entry"
  | "mctb-consent"
  | "mctb-voicemail"
  | "voice-missed-trigger"
  | "existing-consent-capture"
  | "capture"
  | "eligibility"
  | "process"
  | "schedule"
  | "send"
  | "job";

export type MctbPipelineOutcome =
  | "ok"
  | "skip"
  | "fail"
  | "queued"
  | "triggered"
  | "deduped"
  | "suppressed"
  | "sent";

export type MctbPipelineTraceInput = {
  layer: MctbPipelineLayer;
  step: string;
  outcome?: MctbPipelineOutcome;
  reason?: string;
  callSid?: string | null;
  workspaceId?: string | null;
  from?: string | null;
  to?: string | null;
  consentMode?: string | null;
  [key: string]: unknown;
};

/** On by default (including production). Set MCTB_PIPELINE_TRACE=0 to disable. */
export function isMctbPipelineTraceEnabled(): boolean {
  const raw = process.env.MCTB_PIPELINE_TRACE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export function isMctbPipelineTraceVerbose(): boolean {
  const raw = process.env.MCTB_PIPELINE_TRACE?.trim().toLowerCase();
  return raw === "verbose" || raw === "2" || raw === "full";
}

function serializeError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

/** Primary pipeline trace line — grep logs for `[mctb-pipeline]` or `"source":"mctb-pipeline"`. */
export function traceMctbPipeline(input: MctbPipelineTraceInput): void {
  if (!isMctbPipelineTraceEnabled()) return;
  const payload = {
    source: "mctb-pipeline",
    at: new Date().toISOString(),
    ...input,
  };
  console.log(`[mctb-pipeline] ${input.layer}:${input.step}`, JSON.stringify(payload));
}

export function traceMctbPipelineSkip(
  layer: MctbPipelineLayer,
  step: string,
  reason: string,
  fields?: Record<string, unknown>,
): void {
  traceMctbPipeline({ layer, step, outcome: "skip", reason, ...fields });
}

export function traceMctbPipelineOk(
  layer: MctbPipelineLayer,
  step: string,
  fields?: Record<string, unknown>,
): void {
  traceMctbPipeline({ layer, step, outcome: "ok", ...fields });
}

export function traceMctbPipelineError(
  layer: MctbPipelineLayer,
  step: string,
  err: unknown,
  fields?: Record<string, unknown>,
): void {
  if (!isMctbPipelineTraceEnabled()) return;
  const { error, stack } = serializeError(err);
  traceMctbPipeline({ layer, step, outcome: "fail", reason: error, stack, ...fields });
  console.error(`[mctb-pipeline] ${layer}:${step} ERROR`, error);
}

const TEXML_PHONE_KEYS = [
  "From",
  "from",
  "Caller",
  "To",
  "to",
  "Called",
  "ForwardedFrom",
  "forwarded_from",
  "destination_number",
  "CallSid",
  "call_sid",
  "call_control_id",
  "CallStatus",
  "CallStatusEvent",
  "Status",
  "texml_call_status",
  "ConnectionId",
  "connection_id",
  "CallDuration",
  "call_duration",
  "Duration",
  "Direction",
  "direction",
] as const;

/** Compact TeXML payload summary safe for logs. */
export function summarizeTexmlPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TEXML_PHONE_KEYS) {
    const val = payload[key];
    if (typeof val === "string" && val.trim()) out[key] = val.trim();
  }
  const fieldKeys = Object.keys(payload).sort();
  out.fieldCount = fieldKeys.length;
  out.fieldKeys = fieldKeys.slice(0, 40);
  if (isMctbPipelineTraceVerbose()) {
    out.raw = payload;
  }
  return out;
}

export function tracePhoneNormalization(input: {
  layer: MctbPipelineLayer;
  field: string;
  raw: string;
  normalized: string | null;
  callSid?: string | null;
  extra?: Record<string, unknown>;
}): string | null {
  if (!input.raw.trim()) {
    traceMctbPipelineSkip(input.layer, `normalize_${input.field}`, "missing_value", {
      field: input.field,
      callSid: input.callSid ?? null,
      ...input.extra,
    });
    return null;
  }
  const normalized = input.normalized ?? tryNormalizeE164(input.raw);
  if (!normalized) {
    traceMctbPipeline({
      layer: input.layer,
      step: `normalize_${input.field}`,
      outcome: "fail",
      reason: "invalid_phone",
      field: input.field,
      raw: input.raw,
      callSid: input.callSid ?? null,
      ...input.extra,
    });
    return null;
  }
  traceMctbPipelineOk(input.layer, `normalize_${input.field}`, {
    field: input.field,
    raw: input.raw,
    normalized,
    callSid: input.callSid ?? null,
    ...input.extra,
  });
  return normalized;
}
