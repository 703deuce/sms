import assert from "node:assert/strict";
import {
  applyPrimaryIntent,
  applySecondaryIntent,
  createInitialCallState,
  recordCollectedField,
} from "@/lib/voice/real-estate/state";
import {
  applyPolicyEvent,
  assertPolicyAllows,
  canAdvancePipeline,
  checkPolicyInvariant,
  createInitialLeadPolicy,
  mergePolicyFromCallState,
  REAL_ESTATE_POLICY_INVARIANTS,
  recordPolicyField,
} from "@/lib/voice/real-estate/policy";
import {
  FRONT_DESK_TEMPLATE_AGENT_NAMES,
  OUTBOUND_TEMPLATE_AGENT_NAMES,
  REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME,
  REAL_ESTATE_DEPLOYED_OUTBOUND_NAME,
} from "@/lib/voice/real-estate/agent-templates";
import { readProjectFile } from "./_read";

export function verifyRealtorEdgeCases(): void {
  assert.ok(FRONT_DESK_TEMPLATE_AGENT_NAMES.length >= 1);
  assert.ok(OUTBOUND_TEMPLATE_AGENT_NAMES.length >= 1);
  assert.equal(REAL_ESTATE_DEPLOYED_FRONT_DESK_NAME, "Real Estate Front Desk");
  assert.equal(REAL_ESTATE_DEPLOYED_OUTBOUND_NAME, "Amy Speed-to-Lead");

  const deployAgent = readProjectFile("src/lib/voice/real-estate/deploy-agent.ts");
  assert.ok(deployAgent.includes("resolveFrontDeskTemplateAgent"));

  let policy = createInitialLeadPolicy();
  policy = applyPolicyEvent(policy, { type: "represented" });
  assert.throws(() => assertPolicyAllows(policy, "continue_automation"));

  policy = createInitialLeadPolicy();
  policy = applyPolicyEvent(policy, { type: "human_engaged" });
  assert.throws(() => assertPolicyAllows(policy, "continue_automation"));

  policy = createInitialLeadPolicy();
  policy = applyPolicyEvent(policy, { type: "opt_out" });
  assert.equal(checkPolicyInvariant(policy, "place_outbound_call").allowed, false);

  policy = createInitialLeadPolicy();
  policy = applyPolicyEvent(policy, { type: "transfer_failed" });
  assert.equal(policy.needsAttentionReason, "requested_live_handoff_transfer_failed");

  let state = createInitialCallState();
  state = applyPrimaryIntent(state, "buyer");
  state = recordCollectedField(state, "target_areas", "Woodbridge");
  policy = mergePolicyFromCallState(createInitialLeadPolicy(), state);
  policy = recordPolicyField(policy, "target_areas", "Stafford");
  policy = recordPolicyField(policy, "target_areas", "Woodbridge");
  assert.throws(() =>
    assertPolicyAllows(policy, "restart_qualification_field", { fieldId: "target_areas" }),
  );

  state = createInitialCallState();
  state = applyPrimaryIntent(state, "buyer");
  state = applySecondaryIntent(state, "seller");
  policy = mergePolicyFromCallState(createInitialLeadPolicy(), state);
  assert.equal(policy.flags.buyerAndSeller, true);

  assert.equal(canAdvancePipeline("appointment_set", "new_lead"), false);

  policy = createInitialLeadPolicy();
  policy.flags.inboundCallback = true;
  policy.flags.outboundAttemptPending = true;
  assert.throws(() =>
    assertPolicyAllows(policy, "run_inbound_and_outbound_simultaneously"),
  );

  assert.equal(REAL_ESTATE_POLICY_INVARIANTS.length, 10);
}
