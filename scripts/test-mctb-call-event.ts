/**
 * Fast regression for MCTB TeXML inbound demo-call detection (no rebuild, no physical call).
 *
 * Imports the same function the route uses after inbound_prompt:
 *   runMctbConsentTexmlDemoCallDetect()
 *
 * Default payload is the real AT&T forward shape from production cert
 * (override via --from / --to / --forwarded-from or MCTB_TEST_* env vars).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-call-event.ts
 *   npx tsx scripts/test-mctb-call-event.ts --workspace-id cmt3m55zl0p2f5o1l16604i73 --ensure-demo-session
 *   npx tsx scripts/test-mctb-call-event.ts --resolution-only
 *
 * Flags:
 *   --workspace-id <id>     Verify persistence on this workspace (starts demo session with --ensure-demo-session)
 *   --ensure-demo-session   Start/refresh demo session for --from before detect
 *   --resolution-only       Only run workspace resolution queries (no DB write)
 *   --from --to --forwarded-from --call-sid --call-status  Override payload fields
 */
import assert from "node:assert/strict";
import { getPrisma } from "@/lib/db";
import { runMctbConsentTexmlDemoCallDetect } from "@/lib/mctb/consent-prompt/texml-inbound-call-event";
import {
  resolveOnboardingWorkspaceForPlatformInbound,
  startDemoSession,
} from "@/lib/mctb/onboarding/demo";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";

const DEFAULT_CALL = {
  from: process.env.MCTB_TEST_FROM || "+17038166017", // pragma: allowlist secret
  to: process.env.MCTB_TEST_TO || "+15714073615",
  forwardedFrom: process.env.MCTB_TEST_FORWARDED_FROM || "+15714776175", // pragma: allowlist secret
  callStatus: "in-progress",
  callSid: "v3:test-att-forward-ani-preservation",
} as const;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function buildPayload() {
  return {
    from: argValue("--from") || DEFAULT_CALL.from,
    to: argValue("--to") || DEFAULT_CALL.to,
    forwardedFrom: argValue("--forwarded-from") || DEFAULT_CALL.forwardedFrom,
    callStatus: argValue("--call-status") || DEFAULT_CALL.callStatus,
    callSid: argValue("--call-sid") || DEFAULT_CALL.callSid,
  };
}

async function testResolutionQueries(payload: ReturnType<typeof buildPayload>) {
  const prisma = getPrisma();
  await prisma.workspace.findMany({
    where: { customFieldsConfig: { not: { equals: null } } },
    select: { id: true },
    take: 3,
  });
  console.log("  ✓ jsonb filter { not: { equals: null } } (no 22P02)");

  const resolved = await resolveOnboardingWorkspaceForPlatformInbound({
    callerE164: payload.from,
    forwardedFrom: payload.forwardedFrom,
  });
  console.log(
    `  ✓ resolveOnboardingWorkspaceForPlatformInbound → ${resolved ?? "(none)"}`,
  );
}

async function main() {
  const payload = buildPayload();
  const workspaceId = argValue("--workspace-id");
  const resolutionOnly = hasFlag("--resolution-only");

  console.log("MCTB call-event regression\n");
  console.log("Payload:", JSON.stringify(payload, null, 2));
  console.log();

  await testResolutionQueries(payload);

  if (resolutionOnly) {
    console.log("\nResolution-only mode — done");
    return;
  }

  if (workspaceId && hasFlag("--ensure-demo-session")) {
    await startDemoSession({ workspaceId, callerE164: payload.from });
    console.log(`  ✓ demo session started on ${workspaceId}`);
  }

  const result = await runMctbConsentTexmlDemoCallDetect(payload);
  console.log("  detect:", JSON.stringify(result));

  if (result.skippedReason === "not_demo_mode") {
    console.warn(
      "\nWARN: demoMode=false — no persistence write attempted.",
    );
    console.warn(
      "  Pass --workspace-id <id> --ensure-demo-session to force a demo write,",
    );
    console.warn(
      "  or ensure cert workspace has an active demo/forwarding session for this caller.",
    );
    if (!workspaceId) process.exit(0);
  }

  assert.ok(!("code" in (result as object)), "unexpected error code on result");

  const verifyWorkspaceId = workspaceId || result.workspaceId;
  const state = await loadMctbOnboardingState(verifyWorkspaceId);

  if (result.ran) {
    assert.equal(state.demoSession?.status, "call_detected");
    assert.equal(state.demoSession?.lastInboundCall?.from, payload.from);
    assert.equal(state.demoSession?.lastInboundCall?.to, payload.to);
    assert.equal(state.demoSession?.lastInboundCall?.forwardedFrom, payload.forwardedFrom);
    assert.equal(state.demoSession?.lastInboundCall?.callSid, payload.callSid);
    assert.equal(state.demoSession?.lastInboundCall?.callStatus, payload.callStatus);
    console.log(`\n✓ DB persist OK on workspace ${verifyWorkspaceId}`);
    console.log("  demoSession.status = call_detected");
    console.log("  lastInboundCall preserved AT&T payload shape");
  } else if (workspaceId) {
    console.log(`\nSkipped demo write (demoMode=false) — workspace ${verifyWorkspaceId}`);
  }

  console.log("\nAll passed");
}

main().catch((err) => {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  if (code === "22P02") {
    console.error("\nFAILED: Postgres invalid input syntax for type json (22P02)");
  }
  console.error(err);
  process.exit(1);
});
