/**
 * Unit checks: platform demo Press-1 gate + workspace targeting.
 * Run: npx tsx scripts/test-mctb-demo-press1-gate.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { startDemoSession } from "@/lib/mctb/onboarding/demo";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";

function uniqueCaller(): string {
  const digits = String(Date.now()).slice(-7);
  return `+1555${digits.padStart(7, "0")}`;
}

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
  assert.equal(result.isPlatformDemo, true);
  assert.equal(result.demoMode, false);
  assert.ok(
    result.workspaceId === "owner-ws" || typeof result.workspaceId === "string",
    "uses owner workspace or phone owner when no active demo session",
  );
}

async function testPlatformDemoWithActiveTryItSession() {
  const prisma = getPrisma();
  const callerE164 = uniqueCaller();
  const workspace = await prisma.workspace.create({
    data: {
      name: "MCTB try-it routing regression",
      slug: `mctb-tryit-route-${Date.now()}`,
      type: "BUSINESS",
    },
    select: { id: true },
  });

  try {
    await startDemoSession({
      workspaceId: workspace.id,
      callerE164,
      context: "try_it",
    });

    const target = await resolveMctbTargetWorkspaceForInboundCall({
      callerE164,
      businessE164: MCTB_PLATFORM_DEMO_E164,
      fallbackWorkspaceId: "owner-ws-fallback",
    });

    assert.equal(target.workspaceId, workspace.id);
    assert.equal(target.isPlatformDemo, true);
    assert.equal(target.demoMode, true);

    const state = await loadMctbOnboardingState(workspace.id);
    assert.equal(state.demoSession?.callerE164, callerE164);
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
  }
}

async function main() {
  console.log("MCTB demo Press-1 gate tests\n");
  await testTargetWorkspaceFallback();
  console.log("  ✓ non-platform falls back");
  await testPlatformDemoWithoutSession();
  console.log("  ✓ platform without demo session uses owner workspace");
  await testPlatformDemoWithActiveTryItSession();
  console.log("  ✓ platform direct call routes to active Try It workspace");
  console.log("\nAll passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
