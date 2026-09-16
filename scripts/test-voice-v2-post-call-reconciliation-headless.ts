/**
 * Post-call Deepgram reconciliation (mocked transcript text).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-post-call-reconciliation-headless.ts
 */
import assert from "node:assert/strict";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { extractPostCallFieldCandidates } from "../src/lib/voice-v2/post-call/field-extraction";
import { reconcileVoiceV2PostCallRecord } from "../src/lib/voice-v2/post-call/reconciliation";

const schema = intakeSchemaFromWizardOnly(
  {
    fields: {
      name: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
      email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
    },
  },
  [
    { id: "dinosaury", enabled: true, required: true, label: "Dinosaury", askWhen: "always" },
    { id: "mother_s_name", enabled: true, required: true, label: "Mother's name", askWhen: "always" },
  ],
);

const transcript = {
  provider: "deepgram" as const,
  model: "nova-3",
  fullText:
    "Caller: My dinosaury is velociraptor.\nCaller: my email is anthony@example.com\nCaller: Actually her name is Patrice.",
  callerText:
    "My dinosaury is velociraptor. my email is anthony@example.com Actually her name is Patrice.",
  agentText: "Agent: Thanks.",
};

const candidates = extractPostCallFieldCandidates({ pinnedSchema: schema, transcript });
assert.ok(candidates.find((c) => c.fieldKey === "dinosaury")?.candidateValue === "velociraptor");
assert.ok(candidates.find((c) => c.fieldKey === "email")?.candidateValue?.includes("@"));

const reconciled = reconcileVoiceV2PostCallRecord({
  pinned: {
    intakeSchema: schema,
    intakeState: {
      name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      mother_s_name: {
        value: "Patricia",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: "",
      },
    },
    primaryOutcome: "BOOKED",
  },
  transcript,
});

assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patrice");
assert.equal(reconciled.reconciledIntake.dinosaury?.value, "velociraptor");
assert.equal(reconciled.reconciledIntake.email?.value, "anthony@example.com");
console.log("test-voice-v2-post-call-reconciliation-headless: PASS");
