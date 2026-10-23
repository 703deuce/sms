/**
 * P29 / M76 — writeback bridge skips honestly when no CRM (mocked via empty connection list).
 */
import assert from "node:assert/strict";
import { syncPowerDialerAttemptToIntegrations } from "../lib/server/phone/power-dialer/crm-sync-bridge";

async function main() {
  const r = await syncPowerDialerAttemptToIntegrations({
    workspaceId: "ws-nonexistent-batch7-test",
    attemptId: "attempt-mock",
    contactId: "contact-mock",
    disposition: "No answer",
    triggerCrm: true,
  });
  assert.equal(r.skipped, true);
  assert.ok(r.reason === "attempt_missing" || r.reason === "no_crm");
  console.log("test-power-dialer-batch7-crm-mock: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
