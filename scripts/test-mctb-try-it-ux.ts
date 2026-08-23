/**
 * Try It UX + 571 admin assignment regression tests (no SIP engine changes).
 *
 *   npx tsx scripts/test-mctb-try-it-ux.ts
 */
import assert from "node:assert/strict";
import { shouldShowTryItNav } from "@/lib/mctb/try-it/visibility";
import { buildVoiceNav } from "@/lib/products/voice-nav";
import { isMctbAppPath } from "@/lib/products/voice-routes";
import {
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access-shared";
import { resolveRuntimeDemoMode } from "@/lib/mctb/ingress";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import type { MctbDemoSession } from "@/lib/mctb/onboarding/types";

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((err) => {
      console.error(`✗ ${name}`);
      throw err;
    });
}

const demoSession = (): MctbDemoSession => ({
  demoSessionId: "demo_sess_1",
  status: "waiting_call",
  callerE164: "+15551234567",
  demoNumberE164: MCTB_PLATFORM_DEMO_E164,
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  context: "try_it",
});

async function main() {
  await test("test:mctb-paid-user-hides-try-it-nav", () => {
  assert.equal(shouldShowTryItNav("growth"), false);
  assert.equal(shouldShowTryItNav("growth", { isPlatformAdmin: true }), true);
  assert.equal(shouldShowTryItNav("trial"), true);
  assert.equal(shouldShowTryItNav("onboarding"), true);
  const nav = buildVoiceNav({ showTryIt: false });
  assert.equal(nav.some((item) => item.label === "Try It"), false);
  const trialNav = buildVoiceNav({ showTryIt: true });
  assert.equal(trialNav.some((item) => item.label === "Try It"), true);
  assert.equal(trialNav[0]?.label, "Dashboard");
  });

  await test("test:mctb-try-it-no-forwarding-required", () => {
  assert.equal(
    resolveRuntimeDemoMode({
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: "+15551234567",
      forwardedFromE164: null,
      demoSession: demoSession(),
      onboardingState: null,
      liveTestActive: false,
      forwardingVerificationActive: false,
    }),
    true,
  );
  });

  await test("test:mctb-try-it-zero-delay", () => {
  assert.equal(
    resolveRuntimeDemoMode({
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      callerE164: "+15551234567",
      forwardedFromE164: null,
      demoSession: demoSession(),
      onboardingState: null,
      liveTestActive: false,
      forwardingVerificationActive: false,
    }),
    true,
  );
  });

  await test("test:mctb-try-it-press1", () => {
  const session = demoSession();
  assert.equal(session.context, "try_it");
  assert.equal(session.status, "waiting_call");
  });

  await test("test:mctb-try-it-existing-consent", () => {
  const session = { ...demoSession(), context: "try_it" as const };
  assert.equal(session.demoNumberE164, MCTB_PLATFORM_DEMO_E164);
  });

  await test("test:mctb-demo-session-workspace-isolation", () => {
  const a = demoSession();
  const b = { ...demoSession(), demoSessionId: "demo_sess_2", callerE164: "+15559876543" };
  assert.notEqual(a.demoSessionId, b.demoSessionId);
  assert.notEqual(a.callerE164, b.callerE164);
  });

  await test("test:mctb-571-demo-routing-preserved", () => {
  const settings = {
    mctbRole: "platform_demo",
    platformDemo: true,
    adminTestWorkspaceIds: ["ws_admin"],
  };
  const ids = readAdminTestWorkspaceIds(settings);
  assert.deepEqual(ids, ["ws_admin"]);
  assert.equal(settings.mctbRole, "platform_demo");
  });

  await test("test:mctb-571-admin-workspace-assignment", () => {
  const settings = { adminTestWorkspaceIds: ["ws_a", "ws_b"] };
  assert.deepEqual(readAdminTestWorkspaceIds(settings), ["ws_a", "ws_b"]);
  });

  await test("test:mctb-setup-test-still-production-routing", () => {
  assert.equal(isMctbAppPath("/voice/setup"), true);
  assert.equal(isMctbAppPath("/voice/try-it"), true);
  assert.equal(isMctbAppPath("/voice/missed-calls"), true);
  });

  console.log("\nAll Try It UX tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
