/**
 * Generic receptionist manifest tests — five radically different customer configs.
 * Run: npx tsx scripts/test-generic-receptionist-manifests.ts
 */
import assert from "node:assert/strict";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";
import {
  mergeSemanticFieldsForTest,
  parseSemanticFieldPayloadForTest,
} from "../voice-runtime/src/frontdesk/receptionist/collection-semantic-extractor";
import { fieldIdsInManifestOrder } from "../src/lib/voice/receptionist/field-manifest-runtime";
import { missingReceptionistFields } from "../src/lib/voice/receptionist/field-collection-scope";
import { extractDeterministicFieldsFromUtterance } from "../voice-runtime/src/frontdesk/receptionist/collection-field-extractor";
import {
  bookingFieldsComplete,
  enterCollectionState,
  ensureReceptionistWorkflow,
  missingFieldsForPurpose,
  transitionAfterRecordField,
} from "../voice-runtime/src/frontdesk/receptionist/workflow-engine";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

const HVAC: AgentFieldDefinition[] = [
  { id: "system_type", label: "System type", type: "text", required: true, question: "Furnace, heat pump, or AC?" },
  { id: "name", label: "Name", type: "text", required: true, question: "Your name?" },
  { id: "phone", label: "Phone", type: "phone", required: true, question: "Callback number?" },
  { id: "service_address", label: "Service address", type: "address", required: true, question: "Service address?" },
  { id: "hvac_issue", label: "Issue", type: "text", required: true, question: "What's going on?" },
];

const AUTO: AgentFieldDefinition[] = [
  { id: "name", label: "Name", type: "text", required: true, question: "Name?" },
  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?" },
  { id: "vehicle_make", label: "Vehicle make", type: "text", required: true, question: "Make?" },
  { id: "vehicle_model", label: "Vehicle model", type: "text", required: true, question: "Model?" },
  { id: "vehicle_year", label: "Vehicle year", type: "text", required: true, question: "Year?" },
  { id: "service_needed", label: "Service needed", type: "text", required: true, question: "What needs service?" },
];

const DENTIST: AgentFieldDefinition[] = [
  { id: "name", label: "Name", type: "text", required: true, question: "Name?" },
  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?" },
  { id: "email", label: "Email", type: "email", required: true, question: "Email?" },
  { id: "patient_status", label: "Patient status", type: "text", required: true, question: "New or existing?" },
  { id: "appointment_reason", label: "Reason", type: "text", required: true, question: "Reason for visit?" },
  { id: "insurance_provider", label: "Insurance", type: "text", required: false, askWhen: "when_booking", question: "Insurance?" },
];

const LAWYER: AgentFieldDefinition[] = [
  { id: "name", label: "Name", type: "text", required: true, question: "Name?" },
  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?" },
  { id: "case_type", label: "Case type", type: "text", required: true, question: "Type of case?" },
  { id: "opposing_party", label: "Opposing party", type: "text", required: true, question: "Opposing party?" },
  { id: "case_summary", label: "Summary", type: "text", required: true, question: "Brief description?" },
];

const SALON: AgentFieldDefinition[] = [
  { id: "name", label: "Name", type: "text", required: true, question: "Name?" },
  { id: "phone", label: "Phone", type: "phone", required: true, question: "Phone?" },
];

function ud(manifest: AgentFieldDefinition[]): FrontDeskUserData {
  return {
    workspaceId: "w",
    agentId: "a",
    callId: "c",
    businessName: "Test Business",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistCompiled: {
      businessName: "Test",
      timezone: "America/New_York",
      greeting: "Hi",
      capabilities: ["book_appointments", "collect_info"],
      fieldManifest: manifest,
      actionPermissions: {},
      compiledPrompt: "",
    },
    receptionistFields: {},
  };
}

function assertMissingOrder(manifest: AgentFieldDefinition[], fields: Record<string, string>, expectedIds: string[]) {
  const missing = missingReceptionistFields(manifest, fields, "booking").map((f) => f.id);
  assert.deepEqual(missing, expectedIds);
}

assertMissingOrder(HVAC, {}, ["system_type", "name", "phone", "service_address", "hvac_issue"]);
assertMissingOrder(AUTO, { name: "Jane", phone: "+14045551212" }, [
  "vehicle_make",
  "vehicle_model",
  "vehicle_year",
  "service_needed",
]);
assertMissingOrder(SALON, { name: "Bob" }, ["phone"]);

const autoPayload = parseSemanticFieldPayloadForTest(
  JSON.stringify({
    vehicle_make: "Toyota",
    vehicle_model: "Camry",
    vehicle_year: "2019",
    service_needed: "Brakes are squealing",
    correction: false,
  }),
);
const autoMerged = mergeSemanticFieldsForTest(autoPayload!, AUTO, {});
assert.equal(autoMerged.vehicle_make, "Toyota");
assert.equal(autoMerged.vehicle_model, "Camry");
assert.equal(autoMerged.vehicle_year, "2019");
assert.ok(autoMerged.service_needed?.includes("squealing"));

const order = fieldIdsInManifestOrder(AUTO, ["service_needed", "vehicle_make", "vehicle_year"]);
assert.deepEqual(order, ["vehicle_make", "vehicle_year", "service_needed"]);

const hvacUd = ud(HVAC);
enterCollectionState(hvacUd, "booking");
assert.equal(hvacUd.receptionistWorkflow?.activeFieldId, "system_type");

hvacUd.receptionistFields = {
  system_type: "Central AC",
  name: "Jane",
  phone: "+14045551212",
  service_address: "12 Oak St",
  hvac_issue: "No cooling",
};
assert.equal(missingFieldsForPurpose(hvacUd, "booking").length, 0);
assert.equal(bookingFieldsComplete(hvacUd), true);

const salonUd = ud(SALON);
enterCollectionState(salonUd, "booking");
salonUd.receptionistFields = { name: "Amy", phone: "+15714776175" };
transitionAfterRecordField(salonUd, "booking");
assert.equal(ensureReceptionistWorkflow(salonUd).state, "BOOKING_CHECK_AVAILABILITY");

const phoneOnly = extractDeterministicFieldsFromUtterance("5714776175", DENTIST, {});
assert.equal(phoneOnly.fields.phone, "+15714776175");

console.log("✓ generic receptionist manifest tests passed");
