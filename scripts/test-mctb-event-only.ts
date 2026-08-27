/**
 * Fixture tests for MCTB EVENT_ONLY Existing Consent path.
 *
 * Run: npm run test:mctb-event-only
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clampMctbRecoveryDelaySeconds,
  MCTB_RECOVERY_DELAY_DEFAULT_SECONDS,
  MCTB_RECOVERY_DELAY_MAX_SECONDS,
  MCTB_RECOVERY_DELAY_MIN_SECONDS,
} from "../src/lib/mctb/event-only/types";
import { normalizeTelnyxMctbInboundEvent } from "../src/lib/mctb/event-only/normalize";
import { parseTelnyxForwardedFrom } from "../src/lib/voice/telnyx/forwarded-from";
import { MCTB_PLATFORM_DEMO_E164 } from "../src/lib/mctb/onboarding/constants";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_FQDN_DIRECT_TEST_E164,
} from "../src/lib/mctb/sip-diagnostic/constants";
import {
  handleMctbEventOnlyTelnyxWebhook,
  resetMctbEventOnlyTelnyxStateForTests,
  isFqdnDirectMctbTarget,
} from "../src/lib/mctb/event-only/telnyx-handler";

const CALL_ID = "mock_v3:mctb-event-only-test";
const WORKSPACE = "cmt2zyg4l43373s0f146b442h";
const TEST_CALLER = "+12025550101";
const TEST_BUSINESS = "+12025550102";

const attPayload = {
  call_control_id: CALL_ID,
  call_session_id: "sess-event-only-001",
  call_leg_id: "leg-event-only-001",
  connection_id: "conn-event-only-001",
  from: TEST_CALLER,
  to: MCTB_PLATFORM_DEMO_E164,
  direction: "incoming",
  sip_headers: [
    {
      name: "Diversion",
      value: `<sip:${TEST_BUSINESS.replace("+", "")}@one.att.net;user=phone>;reason=no-answer`,
    },
  ],
};

function testDelayBounds() {
  assert.equal(MCTB_RECOVERY_DELAY_MIN_SECONDS, 5);
  assert.equal(MCTB_RECOVERY_DELAY_DEFAULT_SECONDS, 20);
  assert.equal(MCTB_RECOVERY_DELAY_MAX_SECONDS, 300);
  assert.equal(clampMctbRecoveryDelaySeconds(0), 5);
  assert.equal(clampMctbRecoveryDelaySeconds(20), 20);
  assert.equal(clampMctbRecoveryDelaySeconds(999), 300);
}

function testNormalizeAttPayload() {
  const forwarded = parseTelnyxForwardedFrom(attPayload);
  assert.equal(forwarded, TEST_BUSINESS);

  const normalized = normalizeTelnyxMctbInboundEvent(attPayload);
  assert.ok(normalized);
  assert.equal(normalized?.provider, "TELNYX");
  assert.equal(normalized?.providerCallId, CALL_ID);
  assert.equal(normalized?.callerE164, TEST_CALLER);
  assert.equal(normalized?.transovoNumberE164, MCTB_PLATFORM_DEMO_E164);
  assert.equal(normalized?.forwardedFromE164, TEST_BUSINESS);
}

function testFqdnDirectTargetGate() {
  const fqdnPayload = {
    connection_id: MCTB_571_SIP_FQDN_CONNECTION_ID,
    to: MCTB_FQDN_DIRECT_TEST_E164,
    call_control_id: "mock-fqdn",
    direction: "incoming",
  };
  assert.equal(isFqdnDirectMctbTarget(fqdnPayload), true);
  assert.equal(
    isFqdnDirectMctbTarget({ ...fqdnPayload, to: MCTB_PLATFORM_DEMO_E164 }),
    false,
  );
  assert.equal(
    isFqdnDirectMctbTarget({ ...fqdnPayload, connection_id: "other" }),
    false,
  );
}

function testSetupRollbackScripts() {
  const setup571 = join(process.cwd(), "scripts/mctb-setup-571-event-only.ts");
  const rollback571 = join(process.cwd(), "scripts/mctb-rollback-571-event-only.ts");
  const setupFqdn = join(process.cwd(), "scripts/mctb-setup-fqdn-direct-mctb.ts");
  const rollbackFqdn = join(process.cwd(), "scripts/mctb-rollback-fqdn-direct-mctb.ts");
  assert.ok(existsSync(setup571));
  assert.ok(existsSync(rollback571));
  assert.ok(existsSync(setupFqdn));
  assert.ok(existsSync(rollbackFqdn));
  const rollbackSource = readFileSync(rollback571, "utf8");
  assert.match(rollbackSource, /assign571ToConnection/);
  assert.match(rollbackSource, /\.mctb-571-event-only-backup\.json/);
}

async function testTelnyxHandlerNoAnswer() {
  resetMctbEventOnlyTelnyxStateForTests();

  const initiated = await handleMctbEventOnlyTelnyxWebhook({
    eventType: "call.initiated",
    eventPayload: attPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(initiated.handled, true);
  assert.equal(initiated.action, "event_only_capture");

  const hangup = await handleMctbEventOnlyTelnyxWebhook({
    eventType: "call.hangup",
    eventPayload: { ...attPayload, hangup_cause: "normal_clearing" },
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(hangup.handled, true);
  assert.match(hangup.action || "", /hangup/);

  const dup = await handleMctbEventOnlyTelnyxWebhook({
    eventType: "call.initiated",
    eventPayload: attPayload,
    fallbackWorkspaceId: WORKSPACE,
  });
  assert.equal(dup.handled, true);
}

async function main() {
  testDelayBounds();
  testNormalizeAttPayload();
  testFqdnDirectTargetGate();
  testSetupRollbackScripts();
  await testTelnyxHandlerNoAnswer();
  console.log("test-mctb-event-only: ok");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
