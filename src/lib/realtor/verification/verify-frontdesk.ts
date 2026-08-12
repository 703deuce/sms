import assert from "node:assert/strict";
import {
  applyPrimaryIntent,
  applySecondaryIntent,
  createInitialCallState,
  recordCollectedField,
} from "@/lib/voice/real-estate/state";
import {
  fieldsForIntent,
  isIntakeComplete,
  missingRequiredFields,
  normalizeIntent,
} from "@/lib/voice/real-estate/fields";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  isBareLocalContactId,
  parseLocalContactIdFromSafeId,
} from "@/lib/voice/real-estate/contact-id";
import { projectFileExists, readProjectFile } from "./_read";

function scoreFrontDeskCandidateSource(): void {
  const pickSource = readProjectFile("src/lib/voice/frontdesk/pick-frontdesk-agent.ts");
  assert.ok(pickSource.includes("isRealEstateFrontDeskAgent"));
  assert.ok(pickSource.includes("scoreFrontDeskCandidate"));
  assert.ok(pickSource.includes("pickPreferredFrontDeskAgent"));

  const resolveSource = readProjectFile("src/lib/voice/frontdesk/resolve-frontdesk-agent.ts");
  assert.ok(resolveSource.includes("isFrontDeskRuntimeConfig"));
  assert.ok(!resolveSource.includes("frontdesk.id !== routing.agentId"));

  const routingSource = readProjectFile("src/lib/telephony/provisioning/agent-routing.ts");
  assert.ok(routingSource.includes("isFrontDeskRuntimeConfig"));
  assert.ok(routingSource.includes("return routing"));

  const agentPhoneSource = readProjectFile("src/lib/voice/agent-phone.ts");
  assert.ok(agentPhoneSource.includes("isRealEstateFrontDeskAgent"));
}

export function verifyRealEstateFrontdesk(): void {
  assert.equal(isRealEstateFrontDeskAgent({ realEstateFrontDesk: true }), true);
  assert.equal(isRealEstateFrontDeskAgent({ vertical: "real_estate" }), true);
  assert.equal(isRealEstateFrontDeskAgent({ livekitProfile: "frontdesk_realtime" }), false);

  assert.equal(normalizeIntent("buy"), "buyer");
  assert.equal(normalizeIntent("home_seller"), "seller");
  assert.equal(normalizeIntent("tour"), "showing");
  assert.equal(normalizeIntent("realtor"), "agent_to_agent");
  assert.equal(normalizeIntent("unknown_thing"), null);

  assert.equal(parseLocalContactIdFromSafeId("local:cnt_abc"), "cnt_abc");
  assert.equal(parseLocalContactIdFromSafeId("crm:zoho:123"), undefined);
  assert.equal(isBareLocalContactId("cnt_abc"), true);
  assert.equal(isBareLocalContactId("local:cnt_abc"), false);

  const stateSource = readProjectFile("src/lib/voice/real-estate/state.ts");
  assert.ok(stateSource.includes("parseLocalContactIdFromSafeId"));

  const buyerFields = fieldsForIntent("buyer");
  assert.ok(buyerFields.some((f) => f.field_id === "target_areas" && f.required));

  let state = createInitialCallState();
  state = applyPrimaryIntent(state, "buyer");
  assert.equal(state.primaryIntent, "buyer");

  const buyerRequired = [
    "target_areas",
    "property_type",
    "budget_or_price_range",
    "purchase_timeframe",
    "name",
  ];
  for (const fieldId of buyerRequired) {
    state = recordCollectedField(state, fieldId, `test-${fieldId}`);
  }
  assert.equal(isIntakeComplete(["buyer"], state.collectedFields), true);
  assert.equal(state.leadStatus, "qualified");

  state = createInitialCallState();
  state = applyPrimaryIntent(state, "buyer");
  state = applySecondaryIntent(state, "seller");
  const multiMissing = missingRequiredFields(["buyer", "seller"], state.collectedFields);
  assert.ok(multiMissing.some((f) => f.field_id === "property_address"));

  const inboundSource = readProjectFile("voice-runtime/src/inbound-entry.ts");
  const pipelineSource = readProjectFile("voice-runtime/src/inbound-session-pipeline.ts");
  assert.ok(inboundSource.includes("inbound-session-pipeline"));
  assert.ok(pipelineSource.includes("createRealEstateFrontDeskAgent"));
  assert.ok(pipelineSource.includes("inbound_agent_profile"));

  scoreFrontDeskCandidateSource();

  const bootstrapSource = readProjectFile("src/lib/voice/real-estate/bootstrap.ts");
  assert.ok(bootstrapSource.includes("bootstrapRealEstateFrontDesk"));
  assert.ok(bootstrapSource.includes("deployRealtorSpeedToLead"));
  assert.ok(bootstrapSource.includes("compileRealtorAgents"));

  assert.ok(projectFileExists("src/lib/voice/real-estate/compile/index.ts"));
  assert.ok(projectFileExists("src/lib/voice/real-estate/templates/definitions.ts"));

  const instrumentation = readProjectFile("src/instrumentation.ts");
  assert.ok(instrumentation.includes("bootstrapRealEstateFrontDesk"));

  assert.ok(projectFileExists("scripts/fixtures/blue-ridge-realty-rag-knowledge.txt"));
  assert.ok(projectFileExists("src/app/(app)/realtor/onboarding/page.tsx"));
}
