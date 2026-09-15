/**
 * Telnyx PSTN turn observability — extract only fields Telnyx actually sends.
 * UNSUPPORTED fields are never inferred from created_at.
 */

export type TelnyxTurnObservability = {
  speech_end_at: string | null;
  endpoint_detected_at: string | null;
  transcript_final_at: string | null;
  user_turn_committed_at: string | null;
  workflow_transition_started_at: string | null;
  workflow_transition_completed_at: string | null;
  model_turn_started_at: string | null;
  tool_call_emitted_at: string | null;
  flow_node_id: string | null;
  assistant_request_id: string | null;
  end_user_perceived_latency_ms: number | null;
  llm_first_token_duration_ms: number | null;
  audio_first_token_duration_ms: number | null;
  transcription_duration_ms: number | null;
  unsupported: string[];
};

const UNSUPPORTED_BY_DEFAULT = [
  "speech_end_at",
  "endpoint_detected_at",
  "transcript_final_at",
  "user_turn_committed_at",
  "workflow_transition_started_at",
  "workflow_transition_completed_at",
  "model_turn_started_at",
] as const;

/** From Telnyx tool webhook headers/body when present (observability only). */
export function extractTelnyxTurnObservability(input: {
  headers: Headers;
  body: Record<string, unknown>;
}): TelnyxTurnObservability {
  const unsupported = [...UNSUPPORTED_BY_DEFAULT];
  const h = input.headers;
  const meta = (input.body.metadata || input.body.telnyx_metadata || {}) as Record<string, unknown>;

  const userEnded =
    pickString(h, "x-telnyx-user-speech-ended-at") ||
    pickString(h, "x-telnyx-speech-end-at") ||
    pickString(meta, "user_speech_ended_at") ||
    pickString(meta, "speech_end_at");

  if (userEnded) {
    removeUnsupported(unsupported, "speech_end_at");
  }

  const toolEmitted =
    pickString(h, "x-telnyx-tool-called-at") ||
    pickString(input.body, "telnyx_tool_called_at");

  if (toolEmitted) removeUnsupported(unsupported, "tool_call_emitted_at");

  return {
    speech_end_at: userEnded,
    endpoint_detected_at: null,
    transcript_final_at: null,
    user_turn_committed_at: null,
    workflow_transition_started_at: null,
    workflow_transition_completed_at: null,
    model_turn_started_at: null,
    tool_call_emitted_at: toolEmitted,
    flow_node_id: pickString(h, "x-telnyx-flow-node-id") || pickString(meta, "flow_node_id"),
    assistant_request_id: pickString(meta, "request_id"),
    end_user_perceived_latency_ms: pickNum(meta, "end_user_perceived_latency_ms"),
    llm_first_token_duration_ms: pickNum(meta, "llm_first_token_duration_ms"),
    audio_first_token_duration_ms: pickNum(meta, "audio_first_token_duration_ms"),
    transcription_duration_ms: pickNum(meta, "transcription_duration_ms"),
    unsupported,
  };
}

function pickString(source: Headers | Record<string, unknown>, key: string): string | null {
  const v =
    source instanceof Headers
      ? source.get(key)
      : (source as Record<string, unknown>)[key];
  const s = String(v ?? "").trim();
  return s || null;
}

function pickNum(source: Record<string, unknown>, key: string): number | null {
  const v = source[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function removeUnsupported(list: string[], key: string): void {
  const i = list.indexOf(key);
  if (i >= 0) list.splice(i, 1);
}

/** Post-hoc analysis from Telnyx conversation messages (sent_at / ended_at only). */
export function analyzeBookingIntentTurnFromMessages(messages: Array<Record<string, unknown>>): {
  user_speech_end_at: string | null;
  tool_call_sent_at: string | null;
  tool_result_sent_at: string | null;
  amy_audio_sent_at: string | null;
  pre_tool_ms: number | null;
  tool_round_trip_ms: number | null;
  post_tool_to_audio_ms: number | null;
  total_stop_to_audio_ms: number | null;
  user_flow_node: string | null;
  tool_flow_node: string | null;
  telnyx_pre_tool_buckets: {
    speech_end_to_tool_sent_ms: number | null;
    note: string;
  };
  unsupported_pre_tool_subsegments: string[];
} {
  const sorted = [...messages].sort((a, b) =>
    String(a.sent_at || a.created_at).localeCompare(String(b.sent_at || b.created_at)),
  );
  const bookUser = sorted.find(
    (m) => m.role === "user" && String(m.text || "").toLowerCase().includes("book"),
  ) as Record<string, unknown> | undefined;
  if (!bookUser) {
    return emptyAnalysis();
  }
  const userEnd = String(bookUser.ended_at || "");
  const toolMsg = sorted.find(
    (m) =>
      m.role === "assistant" &&
      Array.isArray(m.tool_calls) &&
      (m.tool_calls as unknown[]).length > 0 &&
      new Date(String(m.sent_at)).getTime() >= new Date(userEnd).getTime(),
  ) as Record<string, unknown> | undefined;
  const toolCallId = (toolMsg?.tool_calls as Array<{ id?: string }> | undefined)?.[0]?.id;
  const toolRes = sorted.find(
    (m) => m.role === "tool" && m.tool_call_id === toolCallId,
  ) as Record<string, unknown> | undefined;
  const amyAfter = sorted.find(
    (m) =>
      m.role === "assistant" &&
      String(m.text || "").trim() &&
      toolRes &&
      new Date(String(m.sent_at)).getTime() >= new Date(String(toolRes.sent_at)).getTime(),
  ) as Record<string, unknown> | undefined;

  const pre = diffMs(userEnd, toolMsg?.sent_at);
  const rtt = diffMs(toolMsg?.sent_at, toolRes?.sent_at);
  const post = diffMs(toolRes?.sent_at, amyAfter?.sent_at);
  const total = diffMs(userEnd, amyAfter?.sent_at);

  return {
    user_speech_end_at: userEnd || null,
    tool_call_sent_at: String(toolMsg?.sent_at || "") || null,
    tool_result_sent_at: String(toolRes?.sent_at || "") || null,
    amy_audio_sent_at: String(amyAfter?.sent_at || "") || null,
    pre_tool_ms: pre,
    tool_round_trip_ms: rtt,
    post_tool_to_audio_ms: post,
    total_stop_to_audio_ms: total,
    user_flow_node: String((bookUser.metadata as Record<string, unknown>)?.flow_node_id || "") || null,
    tool_flow_node: String((toolMsg?.metadata as Record<string, unknown>)?.flow_node_id || "") || null,
    telnyx_pre_tool_buckets: {
      speech_end_to_tool_sent_ms: pre,
      note:
        "Telnyx does not expose endpoint/workflow/LLM-start timestamps on messages; entire pre-tool interval is one measured bucket.",
    },
    unsupported_pre_tool_subsegments: [
      "SPEECH_END_TO_ENDPOINT_MS",
      "ENDPOINT_TO_TRANSCRIPT_MS",
      "TRANSCRIPT_TO_WORKFLOW_MS",
      "WORKFLOW_TRANSITION_MS",
      "WORKFLOW_TO_TOOL_DECISION_MS",
    ],
  };
}

function diffMs(a: unknown, b: unknown): number | null {
  const ta = Date.parse(String(a || ""));
  const tb = Date.parse(String(b || ""));
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return tb - ta;
}

function emptyAnalysis() {
  return {
    user_speech_end_at: null,
    tool_call_sent_at: null,
    tool_result_sent_at: null,
    amy_audio_sent_at: null,
    pre_tool_ms: null,
    tool_round_trip_ms: null,
    post_tool_to_audio_ms: null,
    total_stop_to_audio_ms: null,
    user_flow_node: null,
    tool_flow_node: null,
    telnyx_pre_tool_buckets: { speech_end_to_tool_sent_ms: null, note: "" },
    unsupported_pre_tool_subsegments: [],
  };
}
