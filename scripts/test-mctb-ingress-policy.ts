/**
 * MCTB ingress policy — TeXML-only production gate.
 * Run: npm run test:mctb-ingress-policy
 */
import assert from "node:assert/strict";
import {
  MCTB_CANONICAL_ENTRY_PATH,
  MCTB_CANONICAL_PRODUCTION_INGRESS,
  MCTB_LEGACY_VOICE_RUNTIME_ACTIONS,
  checkMctbLegacyIngressBlocked,
  isMctbLegacyIngressEnabled,
  isMctbLegacyVoiceRuntimeAction,
} from "../src/lib/mctb/ingress-policy";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const saved = process.env.MCTB_LEGACY_INGRESS_ENABLED;

function restoreEnv() {
  if (saved === undefined) delete process.env.MCTB_LEGACY_INGRESS_ENABLED;
  else process.env.MCTB_LEGACY_INGRESS_ENABLED = saved;
}

test("canonical production ingress is texml", () => {
  assert.equal(MCTB_CANONICAL_PRODUCTION_INGRESS, "texml");
  assert.equal(MCTB_CANONICAL_ENTRY_PATH, "/api/telnyx/voice/mctb-entry");
});

test("legacy ingress blocked by default", () => {
  delete process.env.MCTB_LEGACY_INGRESS_ENABLED;
  assert.equal(isMctbLegacyIngressEnabled(), false);
  const blocked = checkMctbLegacyIngressBlocked("call_control_event_only");
  assert.ok(blocked);
  assert.equal(blocked?.reason, "legacy_ingress_disabled");
  assert.equal(blocked?.canonicalIngress, "texml");
  assert.equal(blocked?.canonicalEntryPath, MCTB_CANONICAL_ENTRY_PATH);
});

test("legacy ingress allowed when env flag set", () => {
  process.env.MCTB_LEGACY_INGRESS_ENABLED = "1";
  assert.equal(isMctbLegacyIngressEnabled(), true);
  assert.equal(checkMctbLegacyIngressBlocked("sip_livekit"), null);
});

test("voice-runtime MCTB SIP actions are legacy", () => {
  assert.equal(isMctbLegacyVoiceRuntimeAction("capture_mctb_sip_inbound"), true);
  assert.equal(isMctbLegacyVoiceRuntimeAction("bootstrap_inbound"), false);
  assert.ok(MCTB_LEGACY_VOICE_RUNTIME_ACTIONS.has("capture_mctb_sip_inbound"));
  assert.ok(!MCTB_LEGACY_VOICE_RUNTIME_ACTIONS.has("persist_inbound_call"));
});

restoreEnv();
console.log("test-mctb-ingress-policy: ok");
