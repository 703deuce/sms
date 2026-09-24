/**
 * Unit checks for Voice V3 call telemetry metrics.
 */
import assert from "node:assert/strict";
import { shouldSendInitialGreeting } from "../src/lib/voice-v3/greeting";
import {
  VOICE_V3_ASTRA_MODEL,
  VOICE_V3_ASTRA_MODEL_DEFAULT,
} from "../src/lib/voice-v3/intake/delegation-config";
import { VoiceV3CallTrace } from "../src/lib/voice-v3/telemetry/call-trace";
import { buildVoiceNumberProvisioningConfig } from "../src/lib/voice-v3/provisioning/config";

function main() {
  const cfg = buildVoiceNumberProvisioningConfig({
    openaiProjectId: "proj_test",
    appBaseUrl: "https://example.test",
  });
  assert.equal(cfg.liveModel, "gpt-live-1");
  assert.equal(cfg.backendModel, "gpt-6-astra");
  assert.equal(VOICE_V3_ASTRA_MODEL_DEFAULT, "gpt-5.6-sol");
  if (!process.env.VOICE_V3_ASTRA_MODEL?.trim()) {
    assert.equal(VOICE_V3_ASTRA_MODEL, "gpt-5.6-sol");
  }
  assert.equal(cfg.openaiWebhookEvent, "live.transport.incoming");

  assert.equal(shouldSendInitialGreeting("live_sess_1"), true);
  assert.equal(shouldSendInitialGreeting("live_sess_1"), false);

  const t0 = Date.now();
  const trace = new VoiceV3CallTrace({
    callId: "call_test",
    liveSessionId: "live_test",
    frontendModel: "gpt-live-1",
    backendModel: "gpt-6-astra",
    originMs: t0,
  });
  trace.markAt("pstn.call.received", t0);
  trace.markAt("live.transport.incoming", t0 + 40);
  trace.markAt("webhook.verify.completed", t0 + 41);
  trace.markAt("session.accept.request.started", t0 + 68);
  trace.markAt("session.accept.completed", t0 + 312);
  trace.markAt("greeting.requested", t0 + 330);
  trace.markAt("greeting.audio.started", t0 + 715);

  const metrics = trace.computeDerivedMetrics();
  assert.equal(metrics.incoming_to_webhook_ms, 40);
  assert.equal(metrics.webhook_verify_ms, 1);
  assert.equal(metrics.accept_api_ms, 244);
  assert.equal(metrics.incoming_to_first_audio_ms, 675);

  console.log("PASS voice-v3 call trace checks");
}

main();
