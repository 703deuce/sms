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

const manifest = [
  { id: "name", label: "name", required: true, question: "Name?" },
  { id: "phone", label: "phone", required: true, type: "phone" as const, question: "Phone?" },
  { id: "address", label: "address", required: true, question: "Address?" },
  { id: "reason", label: "issue", required: true, question: "Issue?" },
];

const anthonyPayload = parseSemanticFieldPayloadForTest(
  JSON.stringify({
    name: "Anthony",
    phone: { source: "caller_id" },
    address: "Jefferson Davis Highway near Walmart",
    reason: "Upstairs AC has not been cooling since last night",
    correction: false,
  }),
);
assert.ok(anthonyPayload?.name === "Anthony");

const merged = mergeSemanticFieldsForTest(
  anthonyPayload!,
  manifest,
  {},
  "+15714776175",
);
assert.equal(merged.name, "Anthony");
assert.equal(merged.phone, "+15714776175");
assert.ok(merged.address?.includes("Jefferson Davis Highway"));
assert.ok(merged.reason?.includes("cooling"));

const deterministicOnly = extractDeterministicFieldsFromUtterance(
  "571-477-6175",
  manifest,
  {},
);
assert.equal(deterministicOnly.fields.phone, "+15714776175");
assert.equal(Object.keys(deterministicOnly.fields).length, 1);

console.log("✓ collection semantic extractor tests passed");
