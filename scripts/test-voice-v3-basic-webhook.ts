/**
 * Protocol unit checks for Voice V3 Basic Live SIP webhook handler (no network).
 */
import assert from "node:assert/strict";
import {
  buildBasicLiveSessionAcceptParams,
  VOICE_V3_BASIC_BACKEND_MODEL,
  VOICE_V3_BASIC_LIVE_MODEL,
} from "../src/lib/voice-v3-basic/live-session-config";
import {
  extractLiveSessionIdFromWebhookEvent,
  isIncomingOpenAiSipWebhookEvent,
  parseOpenAiLiveWebhookBody,
} from "../src/lib/voice-v3-basic/openai-live-webhook";

function assertNoDelegationIdOnOutbound(payload: unknown): void {
  const json = JSON.stringify(payload);
  assert.equal(json.includes("delegation_id"), false, `unexpected delegation_id in ${json}`);
}

function main() {
  const acceptParams = buildBasicLiveSessionAcceptParams();
  assert.equal(acceptParams.session.model, VOICE_V3_BASIC_LIVE_MODEL);
  assert.equal(acceptParams.session.type, "live");
  assert.equal(acceptParams.session.delegation?.type, "responses");
  const responses =
    acceptParams.session.delegation?.type === "responses"
      ? acceptParams.session.delegation.responses
      : null;
  assert.ok(responses);
  assert.equal(responses.model, VOICE_V3_BASIC_BACKEND_MODEL);
  assert.deepEqual(responses.tools, []);
  const liveText = responses.text as { format?: unknown } | null | undefined;
  assert.equal(liveText?.format, undefined, "Live accept must not include text.format");
  assertNoDelegationIdOnOutbound(acceptParams);

  const sampleIncoming = parseOpenAiLiveWebhookBody(
    JSON.stringify({
      id: "evt_test",
      type: "live.transport.incoming",
      created_at: 1,
      data: {
        type: "sip",
        session_id: "live_test_session_123",
        sip_headers: [],
      },
    }),
  );
  assert.equal(extractLiveSessionIdFromWebhookEvent(sampleIncoming), "live_test_session_123");

  const realtimeIncoming = parseOpenAiLiveWebhookBody(
    JSON.stringify({
      id: "evt_rtc",
      type: "realtime.call.incoming",
      data: { call_id: "rtc_abc123def" },
    }),
  );
  assert.equal(isIncomingOpenAiSipWebhookEvent(realtimeIncoming), true);
  assert.equal(extractLiveSessionIdFromWebhookEvent(realtimeIncoming), "live_abc123def");

  const toolResultOutbound = {
    type: "response.item.create",
    item: {
      type: "function_call_output",
      call_id: "call_abc",
      output: JSON.stringify({ ok: true }),
    },
  };
  assertNoDelegationIdOnOutbound(toolResultOutbound);
  assert.equal(toolResultOutbound.item.call_id, "call_abc");

  const responseCreateOutbound = { type: "response.create" };
  assertNoDelegationIdOnOutbound(responseCreateOutbound);

  console.log("PASS voice-v3-basic webhook protocol checks");
}

main();
