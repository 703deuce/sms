/**
 * Unit checks: platform demo Press-1 gate + workspace targeting.
 * Run: npx tsx scripts/test-mctb-demo-press1-gate.ts
 */
import assert from "node:assert/strict";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";

async function testTargetWorkspaceFallback() {
  const result = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: "+15551234567",
    businessE164: "+18885551234",
    fallbackWorkspaceId: "ws-fallback",
  });
  assert.equal(result.workspaceId, "ws-fallback");
  assert.equal(result.demoMode, false);
  assert.equal(result.isPlatformDemo, false);
}

async function testPlatformDemoWithoutSession() {
  const result = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: "+15551234567",
    businessE164: MCTB_PLATFORM_DEMO_E164,
    fallbackWorkspaceId: "owner-ws",
  });
  assert.equal(result.workspaceId, "owner-ws");
  assert.equal(result.isPlatformDemo, true);
  assert.equal(result.demoMode, false);
}

async function main() {
  console.log("MCTB demo Press-1 gate tests\n");
  await testTargetWorkspaceFallback();
  console.log("  ✓ non-platform falls back");
  await testPlatformDemoWithoutSession();
  console.log("  ✓ platform without demo session uses owner workspace");
  console.log("\nAll passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
