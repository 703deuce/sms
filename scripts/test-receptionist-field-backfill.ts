/**
 * Run: npx tsx scripts/test-receptionist-field-backfill.ts
 */
import assert from "node:assert/strict";
import { ChatContext, ChatMessage } from "@livekit/agents";
import {
  applyReceptionistFieldBackfill,
  heuristicReceptionistFieldBackfill,
  looksLikeFreeformCallerStatement,
} from "../src/lib/voice/receptionist/field-backfill";
import {
  missingReceptionistFields,
  receptionistFieldsForCollection,
} from "../src/lib/voice/receptionist/field-collection-scope";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";

const manifest: AgentFieldDefinition[] = [
  {
    id: "name",
    label: "Full name",
    question: "Name?",
    type: "text",
    required: true,
    askWhen: "every_caller",
  },
  {
    id: "phone",
    label: "Phone",
    question: "Phone?",
    type: "phone",
    required: true,
    askWhen: "new_callers",
  },
  {
    id: "email",
    label: "Email",
    question: "Email?",
    type: "email",
    required: false,
    askWhen: "when_booking",
  },
  {
    id: "reason",
    label: "Reason",
    question: "Reason?",
    type: "text",
    required: false,
    askWhen: "every_caller",
  },
  {
    id: "address",
    label: "Address",
    question: "Address?",
    type: "address",
    required: false,
    askWhen: "service_inquiry",
  },
];

// HVAC-style call (no industry keywords required in heuristics)
const hvacUtterances = [
  "My AC went out last night.",
  "I'm in Arlington.",
  "Anthony Johnson.",
  "571-477-6175",
];
const hvacBackfill = heuristicReceptionistFieldBackfill(hvacUtterances, manifest, {});
assert.ok(hvacBackfill.reason?.toLowerCase().includes("ac"), hvacBackfill);
assert.ok(hvacBackfill.address?.toLowerCase().includes("arlington"), hvacBackfill);
assert.equal(hvacBackfill.name, "Anthony Johnson");
assert.ok(hvacBackfill.phone?.includes("571"), hvacBackfill);

// Electrician
const electrician = heuristicReceptionistFieldBackfill(
  ["I need someone to fix a breaker panel in my garage.", "Maria Lopez.", "202-555-0199"],
  manifest,
  {},
);
assert.ok(electrician.reason?.toLowerCase().includes("breaker"), electrician);

// Plumber
const plumber = heuristicReceptionistFieldBackfill(
  ["There's a leak under my kitchen sink.", "Tom Baker.", "301-555-4422"],
  manifest,
  {},
);
assert.ok(plumber.reason?.toLowerCase().includes("leak"), plumber);

// Real estate
const realtor = heuristicReceptionistFieldBackfill(
  ["I'm looking to list my home this spring.", "Sarah Chen.", "415-555-8822"],
  manifest,
  {},
);
assert.ok(realtor.reason?.toLowerCase().includes("list"), realtor);

assert.ok(looksLikeFreeformCallerStatement("My furnace stopped working."));
assert.ok(!looksLikeFreeformCallerStatement("I'm in Arlington."));
assert.ok(!looksLikeFreeformCallerStatement("John Smith"));

const ctx = ChatContext.empty();
for (const line of hvacUtterances) {
  ctx.insert(new ChatMessage({ role: "user", content: line }));
}
const merged = applyReceptionistFieldBackfill({
  chatCtx: ctx,
  manifest,
  receptionistFields: {},
});
assert.equal(merged.name, "Anthony Johnson");

const orderedMissing = missingReceptionistFields(manifest, {}, "service");
assert.equal(orderedMissing[0]?.id, "reason");
assert.equal(orderedMissing[1]?.id, "name");

const messageScope = receptionistFieldsForCollection(manifest, "message");
assert.ok(messageScope.every((f) => f.required));
assert.ok(!messageScope.some((f) => f.id === "email"));

const serviceMissing = missingReceptionistFields(manifest, { name: "A" }, "service");
assert.ok(serviceMissing.some((f) => f.id === "phone"));
assert.ok(!serviceMissing.some((f) => f.id === "email"));

console.log("test-receptionist-field-backfill: ok");
