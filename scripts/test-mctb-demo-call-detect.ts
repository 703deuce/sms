/**
 * Regression: MCTB demo-call detection must not hit Postgres 22P02 on json/jsonb writes/filters.
 *
 * Real AT&T forward shape from production (override via flags or MCTB_TEST_* env).
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-demo-call-detect.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  recordDemoCallDetected,
  resolveOnboardingWorkspaceForPlatformInbound,
  startDemoSession,
} from "@/lib/mctb/onboarding/demo";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";

const AT_T_CALL = {
  from: process.env.MCTB_TEST_FROM || "+17038166017", // pragma: allowlist secret
  to: process.env.MCTB_TEST_TO || "+15714073615",
  forwardedFrom: process.env.MCTB_TEST_FORWARDED_FROM || "+15714776175", // pragma: allowlist secret
  callStatus: "in-progress",
  callSid: "v3:test-att-forward-ani-preservation",
} as const;

function uniqueTestE164(suffix: string): string {
  const digits = String(Date.now()).slice(-7) + suffix.replace(/\D/g, "").slice(-3).padStart(3, "0");
  return `+1555${digits.slice(0, 7)}`;
}

async function testJsonNotEqualsNullFilter() {
  const prisma = getPrisma();
  // This exact filter shape caused 22P02 in production (neq with { equals: null }).
  const rows = await prisma.workspace.findMany({
    where: { customFieldsConfig: { not: { equals: null } } },
    select: { id: true },
    take: 5,
  });
  assert.ok(Array.isArray(rows));
  console.log("  ✓ customFieldsConfig { not: { equals: null } } filter (no 22P02)");
}

async function testNotTopLevelFilter() {
  const prisma = getPrisma();
  const rows = await prisma.workspace.findMany({
    where: { NOT: { customFieldsConfig: null } },
    select: { id: true },
    take: 5,
  });
  assert.ok(Array.isArray(rows));
  console.log("  ✓ NOT { customFieldsConfig: null } filter (no 22P02)");
}

async function testForwardedFromWorkspaceResolution(workspaceId: string, businessLine: string) {
  const prisma = getPrisma();

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customFieldsConfig: {
        mctbOnboarding: {
          version: 2,
          currentStep: "connect",
          completedSteps: [],
          startedAt: new Date().toISOString(),
          businessNumberE164: businessLine,
          forwardingTestStartedAt: new Date().toISOString(),
          demoSession: null,
        },
      },
    },
  });

  const resolved = await resolveOnboardingWorkspaceForPlatformInbound({
    callerE164: AT_T_CALL.from,
    forwardedFrom: businessLine,
  });
  assert.equal(resolved, workspaceId);
  console.log("  ✓ resolveOnboardingWorkspaceForPlatformInbound (forwardedFrom match)");
}

async function testDemoCallDetectPersist(workspaceId: string, callerE164: string) {
  await startDemoSession({
    workspaceId,
    callerE164,
  });

  await recordDemoCallDetected({
    workspaceId,
    from: AT_T_CALL.from,
    to: AT_T_CALL.to,
    forwardedFrom: AT_T_CALL.forwardedFrom,
    callSid: AT_T_CALL.callSid,
    callStatus: AT_T_CALL.callStatus,
  });

  const state = await loadMctbOnboardingState(workspaceId);
  assert.equal(state.demoSession?.status, "call_detected");
  assert.equal(state.demoSession?.callerE164, callerE164);
  assert.equal(state.demoSession?.lastInboundCall?.from, AT_T_CALL.from);
  assert.equal(state.demoSession?.lastInboundCall?.to, AT_T_CALL.to);
  assert.equal(state.demoSession?.lastInboundCall?.forwardedFrom, AT_T_CALL.forwardedFrom);
  assert.equal(state.demoSession?.lastInboundCall?.callSid, AT_T_CALL.callSid);
  assert.equal(state.demoSession?.lastInboundCall?.callStatus, AT_T_CALL.callStatus);
  console.log("  ✓ recordDemoCallDetected persists demo session + lastInboundCall (AT&T payload)");
}

async function testTexmlTargetResolution(
  workspaceId: string,
  callerE164: string,
  businessLine: string,
) {
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164,
    businessE164: MCTB_PLATFORM_DEMO_E164,
    forwardedFrom: businessLine,
  });
  assert.equal(target.workspaceId, workspaceId);
  assert.equal(target.isPlatformDemo, true);
  assert.equal(target.demoMode, true);
  console.log("  ✓ resolveMctbTargetWorkspaceForInboundCall (demoMode + forwardedFrom)");
}

async function testProductionForwardedFromShapeDoesNotThrow() {
  // Uses the real cert business line; only asserts the query path completes (no 22P02).
  const resolved = await resolveOnboardingWorkspaceForPlatformInbound({
    callerE164: AT_T_CALL.from,
    forwardedFrom: AT_T_CALL.forwardedFrom,
  });
  assert.ok(resolved === null || typeof resolved === "string");
  console.log("  ✓ production AT&T forwardedFrom resolution path (no 22P02)");
}

async function main() {
  console.log("MCTB demo-call detect regression\n");

  await testJsonNotEqualsNullFilter();
  await testNotTopLevelFilter();
  await testProductionForwardedFromShapeDoesNotThrow();

  const prisma = getPrisma();
  const isolatedBusinessLine = `+1571${String(Date.now()).slice(-7)}`;
  const isolatedCaller = uniqueTestE164("01");
  const workspace = await prisma.workspace.create({
    data: {
      name: "MCTB demo-call detect regression",
      slug: `mctb-demo-detect-${Date.now()}`,
    },
  });

  try {
    await testForwardedFromWorkspaceResolution(workspace.id, isolatedBusinessLine);
    await testDemoCallDetectPersist(workspace.id, isolatedCaller);
    await testTexmlTargetResolution(workspace.id, isolatedCaller, isolatedBusinessLine);
    console.log("\nAll passed");
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => undefined);
  }
}

main().catch((err) => {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  if (code === "22P02") {
    console.error("FAILED: Postgres invalid input syntax for type json (22P02)");
  }
  console.error(err);
  process.exit(1);
});
