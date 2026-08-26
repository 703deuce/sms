/**
 * Platform demo inbound must honor tenant consent mode when Diversion header is missing.
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-demo-workspace-routing.ts
 */
import assert from "node:assert/strict";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { resolveMctbSipSessionForPython } from "@/lib/voice/python-runtime-bridge/mctb-sip-session";
import { resolveAdminProductionWorkspaceForPlatformDemoInbound } from "@/lib/mctb/platform-production-routing";

const PLATFORM_OWNER = "cmt2zyg4l43373s0f146b442h";

async function main() {
  const adminWorkspace = await resolveAdminProductionWorkspaceForPlatformDemoInbound();
  assert.ok(adminWorkspace, "expected exactly one admin production workspace with business line");

  const withoutDiversion = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: "+17038166017", // pragma: allowlist secret
    businessE164: "+15714073615",
    fallbackWorkspaceId: PLATFORM_OWNER,
    forwardedFrom: null,
  });
  assert.equal(
    withoutDiversion.workspaceId,
    adminWorkspace,
    "platform demo without Diversion must route to admin production workspace",
  );
  assert.equal(
    await loadMctbConsentMode(withoutDiversion.workspaceId),
    "existing_consent",
    "admin workspace should have existing_consent saved from setup UI",
  );

  const session = await resolveMctbSipSessionForPython({
    callerE164: "+17038166017", // pragma: allowlist secret
    transovoNumberE164: "+15714073615",
    forwardedFromE164: null,
  });
  assert.equal(session.consentMode, "existing_consent");
  assert.ok(session.voicemailPlayUrl, "existing_consent session must include voicemail greeting");
  assert.equal(session.playUrl, undefined, "existing_consent must not load press-1 prompt");

  const withDiversion = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: "+17038166017", // pragma: allowlist secret
    businessE164: "+15714073615",
    fallbackWorkspaceId: PLATFORM_OWNER,
    forwardedFrom: "+15714776175", // pragma: allowlist secret
  });
  assert.equal(withDiversion.workspaceId, adminWorkspace);

  console.log("test-mctb-platform-demo-workspace-routing: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
