/**
 * Full regression tests for Real Estate Front Desk agent.
 * Run: npx tsx scripts/test-real-estate-frontdesk.ts
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
  fieldsForIntent,
  isIntakeComplete,
  missingRequiredFields,
  normalizeIntent,
} from "../src/lib/voice/real-estate/fields";
import { isRealEstateFrontDeskAgent } from "../src/lib/voice/real-estate/config";
import {
  isBareLocalContactId,
  parseLocalContactIdFromSafeId,
} from "../src/lib/voice/real-estate/contact-id";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// --- Config detection ---
assert.equal(isRealEstateFrontDeskAgent({ realEstateFrontDesk: true }), true);
assert.equal(isRealEstateFrontDeskAgent({ vertical: "real_estate" }), true);
assert.equal(isRealEstateFrontDeskAgent({ livekitProfile: "frontdesk_realtime" }), false);

// --- Intent normalization ---
assert.equal(normalizeIntent("buy"), "buyer");
assert.equal(normalizeIntent("home_seller"), "seller");
assert.equal(normalizeIntent("tour"), "showing");
assert.equal(normalizeIntent("realtor"), "agent_to_agent");
assert.equal(normalizeIntent("unknown_thing"), null);

// --- Contact id safety (avoid FK violations on voiceCall.contactId) ---
assert.equal(parseLocalContactIdFromSafeId("local:cnt_abc"), "cnt_abc");
assert.equal(parseLocalContactIdFromSafeId("crm:zoho:123"), undefined);
assert.equal(isBareLocalContactId("cnt_abc"), true);
assert.equal(isBareLocalContactId("local:cnt_abc"), false);

const stateSource = read("src/lib/voice/real-estate/state.ts");
assert.ok(stateSource.includes("parseLocalContactIdFromSafeId"));
assert.ok(stateSource.includes("isBareLocalContactId"));

const reToolsSourceEarly = read("voice-runtime/src/frontdesk/real-estate/re-tools.ts");
assert.ok(reToolsSourceEarly.includes("parseLocalContactIdFromSafeId"));

// --- Buyer field requirements ---
const buyerFields = fieldsForIntent("buyer");
assert.ok(buyerFields.some((f) => f.field_id === "target_areas" && f.required));
assert.ok(buyerFields.some((f) => f.field_id === "budget_or_price_range" && f.required));

let state = createInitialCallState();
state = applyPrimaryIntent(state, "buyer");
assert.equal(state.primaryIntent, "buyer");
assert.equal(state.callerType, "buyer");
assert.equal(state.leadStatus, "intake_in_progress");

const buyerRequired = ["target_areas", "property_type", "budget_or_price_range", "purchase_timeframe", "name"];
for (const fieldId of buyerRequired) {
  state = recordCollectedField(state, fieldId, `test-${fieldId}`);
}
assert.equal(isIntakeComplete(["buyer"], state.collectedFields), true);
assert.equal(state.intakeComplete, true);
assert.equal(state.leadStatus, "qualified");

// --- Multi-intent buyer + seller ---
state = createInitialCallState();
state = applyPrimaryIntent(state, "buyer");
state = applySecondaryIntent(state, "seller");
assert.deepEqual(state.secondaryIntents, ["seller"]);
const multiMissing = missingRequiredFields(["buyer", "seller"], state.collectedFields);
assert.ok(multiMissing.some((f) => f.field_id === "property_address"));
assert.ok(multiMissing.some((f) => f.field_id === "target_areas"));

// --- Seller fields ---
const sellerFields = fieldsForIntent("seller");
assert.ok(sellerFields.some((f) => f.field_id === "property_address" && f.required));
assert.ok(sellerFields.some((f) => f.field_id === "reason_for_selling" && f.required));

// --- Showing fields ---
const showingFields = fieldsForIntent("showing");
assert.ok(showingFields.some((f) => f.field_id === "property_of_interest" && f.required));

// --- Agent-to-agent fields ---
const agentFields = fieldsForIntent("agent_to_agent");
assert.ok(agentFields.some((f) => f.field_id === "agent_name" && f.required));

// --- Runtime wiring ---
const inboundSource = read("voice-runtime/src/inbound-entry.ts");
assert.ok(inboundSource.includes("createRealEstateFrontDeskAgent"));
assert.ok(inboundSource.includes("isRealEstateFrontDeskProfile"));
assert.ok(inboundSource.includes("createInitialCallState"));
assert.ok(inboundSource.includes("isRealEstate ? 12 : 8") || inboundSource.includes("isRealEstate ? 12"));

const reAgentSource = read("voice-runtime/src/frontdesk/real-estate/real-estate-frontdesk-agent.ts");
assert.ok(reAgentSource.includes("buildFrontDeskBookingTools"));
assert.ok(reAgentSource.includes("buildRealEstateLookupContactTool"));

const reToolsSource = read("voice-runtime/src/frontdesk/real-estate/re-tools.ts");
assert.ok(reToolsSource.includes('name: "set_intent"'));
assert.ok(reToolsSource.includes('name: "add_secondary_intent"'));
assert.ok(reToolsSource.includes('name: "record_collected_field"'));
assert.ok(reToolsSource.includes('name: "lookup_contact"'));
assert.ok(reToolsSource.includes('name: "take_message"'));
assert.ok(reToolsSource.includes('name: "get_required_fields"'));
assert.ok(reToolsSource.includes("take_structured_message"));
assert.ok(reToolsSource.includes("syncRealEstateLeadToCrm"));
assert.ok(reToolsSource.includes("notifyRealEstateStaff"));

const instructionsSource = read("voice-runtime/src/frontdesk/real-estate/instructions.ts");
assert.ok(instructionsSource.includes("never mention routing"));
assert.ok(instructionsSource.includes("set_intent"));

const userdataSource = read("voice-runtime/src/frontdesk/userdata.ts");
assert.ok(userdataSource.includes("callState"));

const bookingAgentSource = read("voice-runtime/src/frontdesk/frontdesk-booking-agent.ts");
assert.ok(bookingAgentSource.includes("buildFrontDeskBookingTools"));
assert.ok(!bookingAgentSource.includes("GetEmailTask"));

const crmSyncSource = read("src/lib/voice/real-estate/crm-sync.ts");
assert.ok(crmSyncSource.includes("createCrmNoteForVoice"));
assert.ok(crmSyncSource.includes("createCrmTaskForVoice"));

const notificationsSource = read("src/lib/voice/real-estate/notifications.ts");
assert.ok(notificationsSource.includes("voice.real_estate."));

// --- Setup / deploy scripts ---
const setupSource = read("scripts/setup-real-estate-frontdesk-agent.ts");
assert.ok(setupSource.includes("ensureRealEstateFrontDeskAgent"));

const deployAgentSource = read("src/lib/voice/real-estate/deploy-agent.ts");
assert.ok(deployAgentSource.includes("realEstateFrontDesk: true"));
assert.ok(deployAgentSource.includes("FRONTDESK_REALTIME_PROFILE"));
assert.ok(deployAgentSource.includes("buildRealEstateDraftConfig"));

const seedSource = read("scripts/seed-real-estate-frontdesk-knowledge.ts");
assert.ok(seedSource.includes("seedRealEstateFrontDeskKnowledge"));

const deployKnowledgeSource = read("src/lib/voice/real-estate/deploy-knowledge.ts");
assert.ok(deployKnowledgeSource.includes("processKnowledgeSource(source.id)"));
assert.ok(deployKnowledgeSource.includes("voiceKnowledgeBase.create"));

// --- Fixtures ---
assert.ok(fs.existsSync(path.join(root, "scripts/fixtures/blue-ridge-realty-rag-knowledge.txt")));
assert.ok(fs.existsSync(path.join(root, "src/lib/voice/real-estate/bootstrap.ts")));
assert.ok(fs.existsSync(path.join(root, "src/lib/voice/real-estate/deploy-agent.ts")));
assert.ok(fs.existsSync(path.join(root, "src/lib/voice/real-estate/deploy-knowledge.ts")));

const bootstrapSource = read("src/lib/voice/real-estate/bootstrap.ts");
assert.ok(bootstrapSource.includes("bootstrapRealEstateFrontDesk"));
assert.ok(bootstrapSource.includes("deployRealEstateFrontDesk"));
assert.ok(bootstrapSource.includes("ensureRealEstateFrontDeskAgent"));
assert.ok(bootstrapSource.includes("seedRealEstateFrontDeskKnowledge"));
assert.ok(bootstrapSource.includes("deployRealtorSpeedToLead"));

const deploySpeed = read("src/lib/realtor/deploy-speed-to-lead.ts");
assert.ok(deploySpeed.includes("buildRealtorFollowUpDefinition"));

const instrumentation = read("src/instrumentation.ts");
assert.ok(instrumentation.includes("bootstrapRealEstateFrontDesk"));

const realtorNav = read("src/lib/realtor/nav.ts");
assert.ok(realtorNav.includes("buildRealtorNav"));
assert.ok(realtorNav.includes("/realtor/dashboard"));

assert.ok(fs.existsSync(path.join(root, "src/app/(app)/realtor/onboarding/page.tsx")));
assert.ok(fs.existsSync(path.join(root, "src/app/(app)/realtor/dashboard/page.tsx")));
assert.ok(fs.existsSync(path.join(root, "src/app/(app)/realtor/leads/page.tsx")));

console.log("real-estate frontdesk tests: PASS");
