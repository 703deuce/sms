/**
 * Field Requirements service — config-driven customer field completeness.
 * Run: npx tsx scripts/test-field-requirements.ts
 */
import assert from "node:assert/strict";
import {
  evaluateCustomerCompleteness,
  emptyCustomerCollectedState,
  applyCustomerPayloadToState,
  catalogField,
  buildFieldSubmissionHints,
} from "../src/lib/voice/field-requirements";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

// Business A: name + phone required
const businessA = [
  catalogField("full_name", "required"),
  catalogField("phone", "required"),
  catalogField("email", "preferred"),
];
let state = emptyCustomerCollectedState();
state = applyCustomerPayloadToState(state, { name: "John Smith", phone: "+17035551212" }, "caller");
const aResult = evaluateCustomerCompleteness({
  requirements: businessA,
  state,
  workflow: "general",
});
check("Business A complete without email", aResult.complete);
check("Business A missing email not blocking", aResult.missing_required_fields.length === 0);

// Business B: name + phone + email required
const businessB = [
  catalogField("full_name", "required"),
  catalogField("phone", "required"),
  catalogField("email", "required"),
];
const bResult = evaluateCustomerCompleteness({
  requirements: businessB,
  state,
  workflow: "book_appointment",
});
check("Business B incomplete without email", !bResult.complete);
check("Business B missing email", bResult.missing_required_fields.includes("email"));
check("Business B speak mentions email", Boolean(bResult.speak?.toLowerCase().includes("email")));

// Caller ID seeds phone — do not re-ask
state = applyCustomerPayloadToState(emptyCustomerCollectedState(), { phone: "+17035551212" }, "caller_id");
state = applyCustomerPayloadToState(state, { name: "John" }, "caller");
const cidResult = evaluateCustomerCompleteness({
  requirements: businessB,
  state,
  workflow: "book_appointment",
});
check("Caller ID satisfies phone", cidResult.satisfied_fields.includes("phone"));
check("Only email missing with caller ID", cidResult.missing_required_fields.join() === "email");

// Preferred email — not blocking
const businessPreferred = [
  catalogField("full_name", "required"),
  catalogField("phone", "required"),
  catalogField("email", "preferred"),
];
const prefResult = evaluateCustomerCompleteness({
  requirements: businessPreferred,
  state,
  workflow: "book_appointment",
});
check("Preferred email does not block", prefResult.complete);
check("Preferred email listed separately", prefResult.missing_preferred_fields.includes("email"));

// Problem / notes field round-trip
const notesState = applyCustomerPayloadToState(emptyCustomerCollectedState(), {
  problem_description: "Kitchen sink leaking",
}, "caller");
const notesReq = [catalogField("problem_description", "required")];
const notesOk = evaluateCustomerCompleteness({
  requirements: notesReq,
  state: notesState,
  workflow: "book_appointment",
  incomingArgs: { notes: "Kitchen sink leaking" },
});
check("notes alias satisfies problem_description", notesOk.complete);

const hints = buildFieldSubmissionHints(
  [catalogField("problem_description", "required")],
  ["problem_description"],
);
check("problem hint includes pass_as", hints[0].pass_as.includes("problem_description"));
check("problem hint example payload", Boolean(hints[0].example_payload.problem_description));

const withCustom = [
  catalogField("full_name", "required"),
  catalogField("vehicle_year", "required", {
    label: "Vehicle year",
    type: "number",
    aliases: ["vehicle_year"],
    custom: true,
  }),
];
const customResult = evaluateCustomerCompleteness({
  requirements: withCustom,
  state,
  incomingArgs: { vehicle_year: "2019" },
  workflow: "request_quote",
});
check("Custom field from incoming args", customResult.complete);

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll field requirement checks passed.");
