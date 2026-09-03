#!/usr/bin/env tsx
/**
 * Cross-tenant inbound SMS workspace routing regression tests.
 * Run: npx tsx scripts/test-inbound-sms-workspace-routing.ts
 */
import assert from "node:assert/strict";
import {
  INBOUND_OUTBOUND_PAIRING_WINDOW_MS,
  isMirrorOrArchivedPhoneRow,
  pickWorkspaceFromKeywordMatches,
  pickWorkspaceFromMirrorDisambiguation,
  pickWorkspaceFromOutboundPairing,
  resolvePhoneCandidateWithoutLookup,
  type InboundPhoneCandidate,
} from "../src/lib/messaging/inbound-workspace-routing-policy";

function row(
  workspaceId: string,
  overrides: Partial<InboundPhoneCandidate> = {},
): InboundPhoneCandidate {
  return {
    id: `pn_${workspaceId}`,
    workspaceId,
    e164: "+15714073615",
    settingsJson: {},
    status: "Active",
    ...overrides,
  };
}

function testOutboundPairingPicksMostRecent() {
  const winner = pickWorkspaceFromOutboundPairing([
    { workspaceId: "ws_old", createdAt: new Date("2026-01-01T00:00:00Z") },
    { workspaceId: "ws_new", createdAt: new Date("2026-01-02T00:00:00Z") },
  ]);
  assert.equal(winner, "ws_new");
  console.log("PASS outbound pairing picks most recent");
}

function testKeywordMatchRequiresUniqueWorkspace() {
  assert.equal(
    pickWorkspaceFromKeywordMatches([{ workspaceId: "ws_a" }, { workspaceId: "ws_a" }]),
    "ws_a",
  );
  assert.equal(
    pickWorkspaceFromKeywordMatches([{ workspaceId: "ws_a" }, { workspaceId: "ws_b" }]),
    null,
  );
  console.log("PASS keyword match requires unique workspace");
}

function testMirrorDisambiguation() {
  const mirror = row("ws_mirror", {
    settingsJson: { mctbRole: "platform_demo" },
  });
  const primary = row("ws_primary", {
    settingsJson: { mctbRole: "customer_production" },
  });
  const picked = pickWorkspaceFromMirrorDisambiguation([mirror, primary]);
  assert.equal(picked?.workspaceId, "ws_primary");
  assert.equal(isMirrorOrArchivedPhoneRow(mirror), true);
  assert.equal(isMirrorOrArchivedPhoneRow(primary), false);
  console.log("PASS mirror disambiguation prefers non-demo row");
}

async function testSinglePhoneRow() {
  const result = resolvePhoneCandidateWithoutLookup({
    toE164: "+15714073615",
    candidates: [row("ws_only")],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.workspaceId, "ws_only");
    assert.equal(result.reason, "single_phone_row");
  }
  console.log("PASS single phone row routes directly");
}

async function testDuplicateFailsClosedWithoutSignals() {
  const result = resolvePhoneCandidateWithoutLookup({
    toE164: "+15714073615",
    candidates: [
      row("ws_a", { settingsJson: { mctbRole: "customer_production" } }),
      row("ws_b", { settingsJson: { mctbRole: "customer_production" } }),
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "ambiguous_duplicate_e164");
  }
  console.log("PASS duplicate E.164 fails closed without disambiguation");
}

async function testMirrorOnlyDuplicateResolves() {
  const result = resolvePhoneCandidateWithoutLookup({
    toE164: "+15714073615",
    candidates: [
      row("ws_mirror", { settingsJson: { mctbRole: "platform_demo" } }),
      row("ws_primary", { settingsJson: { mctbRole: "customer_production" } }),
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.workspaceId, "ws_primary");
    assert.equal(result.reason, "mirror_disambiguation");
  }
  console.log("PASS mirror duplicate resolves to primary row");
}

function testPairingWindowConstant() {
  assert.equal(INBOUND_OUTBOUND_PAIRING_WINDOW_MS, 14 * 24 * 60 * 60 * 1000);
  console.log("PASS pairing window is 14 days");
}

async function main() {
  console.log("\n=== Inbound SMS workspace routing ===\n");
  testOutboundPairingPicksMostRecent();
  testKeywordMatchRequiresUniqueWorkspace();
  testMirrorDisambiguation();
  testPairingWindowConstant();
  await testSinglePhoneRow();
  await testDuplicateFailsClosedWithoutSignals();
  await testMirrorOnlyDuplicateResolves();
  console.log("\nAll inbound workspace routing checks passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
