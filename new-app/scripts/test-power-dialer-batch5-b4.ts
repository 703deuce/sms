import assert from "node:assert/strict";
import { pickCampaignCallerId, advanceCallerIdRotationPointer, advanceTeamQueuePointer } from "../lib/server/phone/power-dialer/caller-id-pool";
import { auditComplianceDecision } from "../lib/server/phone/power-dialer/compliance-gates";
import { parseListDialConsent, contactHasListConsentException } from "../lib/server/phone/power-dialer/list-consent";
import { parseCadenceSteps } from "../lib/server/phone/power-dialer/cadence-engine";
import { parseDispositionActions } from "../lib/server/phone/power-dialer/disposition-actions";
import { getCampaignAbandonedMetrics } from "../lib/server/phone/power-dialer/abandoned-metrics";

async function main() {
  const consent = parseListDialConsent({
    basis: "existing_permission",
    attestedAt: new Date().toISOString(),
  });
  assert.equal(consent?.basis, "existing_permission");

  const steps = parseCadenceSteps([
    { type: "wait", waitMinutes: 30 },
    { type: "call" },
    { type: "sms", body: "Hi" },
  ]);
  assert.equal(steps.length, 3);

  const actions = parseDispositionActions({
    id: "d",
    setId: "s",
    label: "X",
    category: "outcome",
    answerContext: "any",
    sortOrder: 0,
    requireNotes: false,
    markConnected: false,
    markContactCompleted: false,
    scheduleCallback: false,
    removeFromQueue: false,
    addToDnc: false,
    triggerCrmUpdate: false,
    triggerFollowUp: true,
    actionsJson: [{ type: "crm_note", noteBody: "test" }, { type: "create_deal", taskTitle: "Deal" }],
  });
  assert.equal(actions.length, 2);
  assert.equal(actions[1].type, "create_deal");

  // Pointer helpers are pure persistence — smoke import only
  assert.equal(typeof advanceCallerIdRotationPointer, "function");
  assert.equal(typeof advanceTeamQueuePointer, "function");
  assert.equal(typeof pickCampaignCallerId, "function");
  assert.equal(typeof contactHasListConsentException, "function");
  assert.equal(typeof auditComplianceDecision, "function");
  assert.equal(typeof getCampaignAbandonedMetrics, "function");

  console.log("test-power-dialer-batch5-b4: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
