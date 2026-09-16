/**
 * Post-call Deepgram reconciliation + structured extraction + final summary.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-post-call-reconciliation-headless.ts
 */
import assert from "node:assert/strict";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-v2/intake/compile-schema";
import { buildReconciledCallSummaryText } from "../src/lib/voice-v2/post-call/final-summary";
import { extractPostCallFieldCandidates } from "../src/lib/voice-v2/post-call/field-extraction";
import { reconcileVoiceV2PostCallRecord } from "../src/lib/voice-v2/post-call/reconciliation";
import { parseStructuredExtractionJson } from "../src/lib/voice-v2/post-call/structured-extraction";
import { structuredRowsToPostCallCandidates } from "../src/lib/voice-v2/post-call/structured-extraction-types";

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
    { id: "purple_monkey_count", enabled: true, required: false, label: "Purple monkey count", askWhen: "always" },
  ],
);

const baseTranscript = {
  provider: "deepgram" as const,
  model: "nova-3",
  fullText:
    "Agent: What is your mother's name?\nCaller: Patrice.\nCaller: My dinosaury is velociraptor.\nCaller: my email is anthony@example.com",
  callerText:
    "Patrice. My dinosaury is velociraptor. my email is anthony@example.com",
  agentText: "What is your mother's name?",
};

// A — casual custom field (rules + structured fixture)
{
  const casual = {
    ...baseTranscript,
    fullText: "Caller: Oh yeah, my dinosaury is velociraptor.",
    callerText: "Oh yeah, my dinosaury is velociraptor.",
  };
  const rules = extractPostCallFieldCandidates({ pinnedSchema: schema, transcript: casual });
  assert.equal(rules.find((c) => c.fieldKey === "dinosaury")?.candidateValue, "velociraptor");

  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "dinosaury",
          status: "FOUND",
          candidateValue: "velociraptor",
          confidence: 0.93,
          evidenceSpeaker: "caller",
          evidenceSpan: "Oh yeah, my dinosaury is velociraptor.",
        },
      ],
    },
    schema,
  );
  assert.ok(fixture);
  const mergedCandidates = structuredRowsToPostCallCandidates(fixture!.fields);
  const dinoCand = mergedCandidates.find((c) => c.fieldKey === "dinosaury");
  assert.equal(dinoCand?.candidateValue, "velociraptor");
  console.log("PASS A_arbitrary_custom_field");
}

// B — context-dependent mother_s_name via structured JSON
{
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "mother_s_name",
          status: "FOUND",
          candidateValue: "Patrice",
          confidence: 0.91,
          evidenceSpeaker: "caller",
          evidenceSpan: "Patrice.",
        },
      ],
    },
    schema,
  );
  const candidates = structuredRowsToPostCallCandidates(fixture!.fields);
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: { intakeSchema: schema, intakeState: {} },
    transcript: baseTranscript,
    candidates,
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patrice");
  console.log("PASS B_context_mother_name");
}

// C — correction Patricia → Patrice
{
  const transcript = {
    ...baseTranscript,
    callerText:
      "Her name is Patricia. Actually her name is Patrice. My dinosaury is velociraptor.",
    fullText:
      "Caller: Her name is Patricia.\nCaller: Actually her name is Patrice.\nCaller: My dinosaury is velociraptor.",
  };
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: {
          value: "Patricia",
          status: "CAPTURED",
          source: "CALLER",
          updatedAt: "",
        },
      },
    },
    transcript,
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patrice");
  console.log("PASS C_correction");
}

// D — ambiguous → REVIEW
{
  const candidates = structuredRowsToPostCallCandidates([
    {
      fieldKey: "mother_s_name",
      status: "AMBIGUOUS",
      confidence: 0.4,
      evidenceSpan: "conflicting audio",
    },
  ]);
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: {
          value: "Patricia",
          status: "CAPTURED",
          source: "CALLER",
          updatedAt: "",
        },
      },
    },
    transcript: baseTranscript,
    candidates,
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patricia");
  assert.ok(reconciled.needsReview);
  assert.ok(reconciled.fields.some((f) => f.verdict === "REVIEW"));
  console.log("PASS D_ambiguous_review");
}

// E — missing field
{
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: { intakeSchema: schema, intakeState: {} },
    transcript: {
      ...baseTranscript,
      callerText: "Hello.",
      fullText: "Caller: Hello.",
    },
  });
  assert.ok(
    reconciled.fields.some(
      (f) => f.fieldKey === "purple_monkey_count" && f.verdict === "MISSING",
    ),
  );
  console.log("PASS E_missing");
}

// F — final summary uses reconciled values
{
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: {
          value: "Patricia",
          status: "CAPTURED",
          source: "CALLER",
          updatedAt: "",
        },
      },
    },
    transcript: baseTranscript,
  });
  const summary = buildReconciledCallSummaryText({
    intakeSchema: schema,
    reconciledIntake: reconciled.reconciledIntake,
  });
  assert.match(summary, /Patrice/i);
  assert.doesNotMatch(summary, /\bPatricia\b/);
  console.log("PASS F_summary_after_reconcile");
}

// G — BOOKED locks fields (no post-call overwrite)
{
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: {
          value: "Patricia",
          status: "CAPTURED",
          source: "CALLER",
          updatedAt: "",
        },
      },
      primaryOutcome: "BOOKED",
    },
    transcript: baseTranscript,
    providerLockedFields: schema.fields.map((f) => f.key),
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patricia");
  console.log("PASS G_provider_booked_lock");
}

console.log("test-voice-v2-post-call-reconciliation-headless: ALL PASS");
