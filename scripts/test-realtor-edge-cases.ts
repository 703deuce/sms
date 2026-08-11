/**
 * Real-estate edge-case regression suite — policy + state machine invariants.
 * Run: npx tsx scripts/test-realtor-edge-cases.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  applyPrimaryIntent,
  applySecondaryIntent,
  createInitialCallState,
  recordCollectedField,
} from "../src/lib/voice/real-estate/state";
import {
  applyPolicyEvent,
  assertPolicyAllows,
  canAdvancePipeline,
  checkPolicyInvariant,
  createInitialLeadPolicy,
  mergePolicyFromCallState,
  REAL_ESTATE_POLICY_INVARIANTS,
  recordPolicyField,
} from "../src/lib/voice/real-estate/policy";
import {
  FRONT_DESK_TEMPLATE_AGENT_NAMES,
  OUTBOUND_TEMPLATE_AGENT_NAMES,
  REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME,
  REAL_ESTATE_DEPLOYED_OUTBOUND_NAME,
} from "../src/lib/voice/real-estate/agent-templates";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// --- Template wiring ---
assert.ok(FRONT_DESK_TEMPLATE_AGENT_NAMES.length >= 1);
assert.ok(OUTBOUND_TEMPLATE_AGENT_NAMES.length >= 1);
assert.equal(REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME, "Real Estate Front Desk");
assert.equal(REAL_ESTATE_DEPLOYED_OUTBOUND_NAME, "Amy Speed-to-Lead");

const deployAgent = read("src/lib/voice/real-estate/deploy-agent.ts");
assert.ok(deployAgent.includes("resolveFrontDeskTemplateAgent"));

const deployOutbound = read("src/lib/realtor/deploy-speed-to-lead.ts");
assert.ok(deployOutbound.includes("resolveOutboundTemplateAgent"));
assert.ok(deployOutbound.includes("REAL_ESTATE_DEPLOYED_OUTBOUND_NAME"));

// --- Edge 1: human relationship / represented ---
let policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "represented" });
assert.equal(policy.flags.represented, true);
assert.equal(policy.flags.automationPaused, true);
assert.throws(() => assertPolicyAllows(policy, "continue_automation"));

// --- Edge 2: human engaged pauses automation ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "human_engaged" });
assert.throws(() => assertPolicyAllows(policy, "continue_automation"));

// --- Edge 3: callback scheduled ≠ qualified ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, {
  type: "callback_scheduled",
  payload: { callbackAt: new Date(Date.now() + 3600_000).toISOString() },
});
assert.equal(policy.flags.callbackScheduled, true);
assert.equal(policy.outcome, "callback_scheduled");
assert.notEqual(policy.pipelineStage, "qualified");

// --- Edge 4: transfer failed → needs attention ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "transfer_failed" });
assert.equal(policy.needsAttentionReason, "requested_live_handoff_transfer_failed");

// --- Edge 5: opt-out blocks outbound ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "opt_out" });
const optOutCheck = checkPolicyInvariant(policy, "place_outbound_call");
assert.equal(optOutCheck.allowed, false);

// --- Edge 7: never submitted ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "never_submitted" });
assert.equal(policy.outcome, "accidental_submission");

// --- Edge 8: spam suspected ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "spam_suspected" });
assert.equal(policy.outcome, "spam_bot_suspected");

// --- Edge 13/14: multi-field capture + field supersede ---
let state = createInitialCallState();
state = applyPrimaryIntent(state, "buyer");
state = recordCollectedField(
  state,
  "target_areas",
  "Stafford or Fredericksburg under 500k, 3-4 beds, preapproved",
);
state = recordCollectedField(state, "target_areas", "Woodbridge");
policy = mergePolicyFromCallState(createInitialLeadPolicy(), state);
policy = recordPolicyField(policy, "target_areas", "Stafford");
policy = recordPolicyField(policy, "target_areas", "Woodbridge");
assert.deepEqual(policy.fieldHistory.target_areas, ["Stafford", "Woodbridge"]);
assert.throws(() =>
  assertPolicyAllows(policy, "restart_qualification_field", { fieldId: "target_areas" }),
);

// --- Edge 15: buyer + seller same person ---
state = createInitialCallState();
state = applyPrimaryIntent(state, "buyer");
state = applySecondaryIntent(state, "seller");
policy = mergePolicyFromCallState(createInitialLeadPolicy(), state);
assert.equal(policy.flags.buyerAndSeller, true);

// --- Edge 16: agent-to-agent ---
state = createInitialCallState();
state = applyPrimaryIntent(state, "agent_to_agent");
policy = mergePolicyFromCallState(createInitialLeadPolicy(), state);
assert.equal(policy.flags.outsideAgent, true);

// --- Edge 24: appointment without receipt blocked ---
policy = createInitialLeadPolicy();
assert.throws(() =>
  assertPolicyAllows(policy, "mark_appointment_booked", { providerReceiptConfirmed: false }),
);
assert.doesNotThrow(() =>
  assertPolicyAllows(policy, "mark_appointment_booked", { providerReceiptConfirmed: true }),
);

// --- Edge 28/30: inbound callback cancels outbound pending ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "outbound_attempt_queued" });
policy = applyPolicyEvent(policy, { type: "inbound_callback" });
assert.equal(policy.flags.outboundAttemptPending, false);

policy = createInitialLeadPolicy();
policy.flags.inboundCallback = true;
policy.flags.outboundAttemptPending = true;
assert.throws(() =>
  assertPolicyAllows(policy, "run_inbound_and_outbound_simultaneously"),
);

// --- Edge 38: pipeline regression blocked ---
assert.equal(canAdvancePipeline("appointment_set", "new_lead"), false);
assert.equal(canAdvancePipeline("qualified", "appointment_set"), true);

// --- Edge 49: duplicate outbound job ---
policy = createInitialLeadPolicy();
policy = applyPolicyEvent(policy, { type: "outbound_attempt_queued" });
const dupJob = checkPolicyInvariant(policy, "create_duplicate_outbound_job");
assert.equal(dupJob.allowed, false);

// --- Edge 50: unverified property facts ---
const propertyCheck = checkPolicyInvariant(createInitialLeadPolicy(), "answer_unverified_property_fact", {
  authoritativePropertyData: false,
});
assert.equal(propertyCheck.allowed, false);

// --- UI polish wiring ---
const mobileNav = read("src/components/layout/mobile-nav.tsx");
assert.ok(mobileNav.includes("buildRealtorMobileNav"));
assert.ok(mobileNav.includes("realtorMode"));

const sidebar = read("src/components/layout/sidebar.tsx");
assert.ok(sidebar.includes("Transovo Real Estate"));
assert.ok(sidebar.includes("/realtor/dashboard"));

const appShell = read("src/components/layout/app-shell.tsx");
assert.ok(appShell.includes("getRealtorPageTitle"));

const leadsPage = read("src/app/(app)/realtor/leads/page.tsx");
assert.ok(leadsPage.includes("view === \"pipeline\""));

assert.equal(REAL_ESTATE_POLICY_INVARIANTS.length, 10);

console.log("realtor edge-case tests: PASS");
