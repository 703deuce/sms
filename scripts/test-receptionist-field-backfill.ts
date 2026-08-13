/**
 * Run: npx tsx scripts/test-receptionist-field-backfill.ts
 */
import assert from "node:assert/strict";
import { ChatContext, ChatMessage } from "@livekit/agents";
import {
  applyReceptionistFieldBackfill,
  heuristicReceptionistFieldBackfill,
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

const utterances = [
  "My AC went out.",
  "I'm in Arlington.",
  "Anthony Johnson.",
  "571-477-6175",
];

const backfill = heuristicReceptionistFieldBackfill(utterances, manifest, {});
assert.ok(backfill.reason?.includes("AC"), backfill);
assert.ok(backfill.address?.includes("Arlington"), backfill);
assert.equal(backfill.name, "Anthony Johnson");
assert.ok(backfill.phone?.includes("571"), backfill);

const ctx = ChatContext.empty();
for (const line of utterances) {
  ctx.insert(new ChatMessage({ role: "user", content: line }));
}
const merged = applyReceptionistFieldBackfill({
  chatCtx: ctx,
  manifest,
  receptionistFields: {},
});
assert.equal(merged.name, "Anthony Johnson");

const messageScope = receptionistFieldsForCollection(manifest, "message");
assert.ok(messageScope.every((f) => f.required));
assert.ok(!messageScope.some((f) => f.id === "email"));

const serviceMissing = missingReceptionistFields(manifest, { name: "A" }, "service");
assert.ok(serviceMissing.some((f) => f.id === "phone"));
assert.ok(!serviceMissing.some((f) => f.id === "email"));

console.log("test-receptionist-field-backfill: ok");
