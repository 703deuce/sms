/**
 * Unit tests for semantic field extraction JSON merge (no network).
 * Run: npx tsx scripts/test-collection-semantic-extractor.ts
 */
import assert from "node:assert/strict";
import {
  mergeSemanticFieldsForTest,
  parseSemanticFieldPayloadForTest,
} from "../voice-runtime/src/frontdesk/receptionist/collection-semantic-extractor";
import { extractDeterministicFieldsFromUtterance } from "../voice-runtime/src/frontdesk/receptionist/collection-field-extractor";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";

const manifest: AgentFieldDefinition[] = [
  { id: "name", label: "name", required: true, question: "Name?" },
  { id: "phone", label: "phone", required: true, type: "phone", question: "Phone?" },
  { id: "address", label: "address", required: true, question: "Address?" },
  { id: "reason", label: "issue", required: true, question: "Issue?" },
];

const autoManifest: AgentFieldDefinition[] = [
  { id: "vehicle_make", label: "Make", type: "text", required: true, question: "Make?" },
  { id: "vehicle_model", label: "Model", type: "text", required: true, question: "Model?" },
  { id: "vehicle_year", label: "Year", type: "text", required: true, question: "Year?" },
  { id: "service_needed", label: "Service", type: "text", required: true, question: "Service?" },
];

const anthonyUtterance =
  "I'm Anthony, use the number I'm calling from, I'm over in Arlington near Route 1, and the upstairs unit quit cooling last night.";

const anthonyPayload = parseSemanticFieldPayloadForTest(
  JSON.stringify({
    name: "Anthony",
    phone_use_caller_id: true,
    address: "Arlington near Route 1",
    reason: "Upstairs unit quit cooling last night",
    correction: false,
  }),
);
assert.ok(anthonyPayload?.name === "Anthony");

const anthonyMerged = mergeSemanticFieldsForTest(
  anthonyPayload!,
  manifest,
  {},
  "+15714776175",
);
assert.equal(anthonyMerged.name, "Anthony");
assert.equal(anthonyMerged.phone, "+15714776175");
assert.ok(anthonyMerged.address?.includes("Arlington"));
assert.ok(anthonyMerged.reason?.includes("cooling"));

const autoPayload = parseSemanticFieldPayloadForTest(
  JSON.stringify({
    vehicle_make: "Toyota",
    vehicle_model: "Camry",
    vehicle_year: "2019",
    service_needed: "Brakes are squealing",
  }),
);
const autoMerged = mergeSemanticFieldsForTest(autoPayload!, autoManifest, {});
assert.equal(autoMerged.vehicle_make, "Toyota");
assert.equal(autoMerged.vehicle_model, "Camry");

const deterministicOnly = extractDeterministicFieldsFromUtterance(
  "571-477-6175",
  manifest,
  {},
);
assert.equal(deterministicOnly.fields.phone, "+15714776175");
assert.equal(Object.keys(deterministicOnly.fields).length, 1);

const compoundPartial = extractDeterministicFieldsFromUtterance(
  anthonyUtterance,
  manifest,
  {},
  "+15714776175",
);
assert.ok(
  Object.keys(compoundPartial.fields).length < 4,
  "compound utterance should not be fully resolved by deterministic alone",
);

console.log("✓ collection semantic extractor tests passed");
