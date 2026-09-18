/**
 * Post-call LLM extraction (fixtures) + deterministic reconciliation + final summary.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-post-call-reconciliation-headless.ts
 */
import assert from "node:assert/strict";
import { intakeSchemaFromWizardOnly } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import {
  buildDynamicExtractionSchema,
  extractionSchemaFieldKeys,
} from "../src/lib/voice-receptionist-wizard/post-call/extraction-schema";
import { buildReconciledCallSummaryText } from "../src/lib/voice-receptionist-wizard/post-call/final-summary";
import { reconcileVoiceV2PostCallRecord } from "../src/lib/voice-receptionist-wizard/post-call/reconciliation";
import { parseStructuredExtractionJson } from "../src/lib/voice-receptionist-wizard/post-call/structured-extraction";
import { structuredRowsToPostCallCandidates } from "../src/lib/voice-receptionist-wizard/post-call/structured-extraction-types";

function schemaBuiltinOnly() {
  return intakeSchemaFromWizardOnly(
    {
      fields: {
        phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        address: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        name: { enabled: false, requirementLevel: "OPTIONAL" },
        service_reason: { enabled: false, requirementLevel: "OPTIONAL" },
      },
    },
    [],
  );
}

function schemaWithCustom() {
  return intakeSchemaFromWizardOnly(
    {
      fields: {
        phone: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        email: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        address: { enabled: true, requirementLevel: "REQUIRED_FOR_RECORD" },
        name: { enabled: false, requirementLevel: "OPTIONAL" },
        service_reason: { enabled: false, requirementLevel: "OPTIONAL" },
      },
    },
    [
      { id: "mother_s_name", enabled: true, required: true, label: "Mother's name", askWhen: "always" },
      { id: "dinosaury", enabled: true, required: true, label: "Dinosaury", askWhen: "always" },
    ],
  );
}

const transcriptMotherSusan = {
  provider: "deepgram" as const,
  model: "nova-3",
  fullText:
    "Agent: What's your mother's name?\nCaller: Susan.\nCaller: My dinosaury is velociraptor.",
  callerText: "Susan. My dinosaury is velociraptor.",
  agentText: "What's your mother's name?",
};

// A — built-in fields only in dynamic extraction schema
{
  const schema = schemaBuiltinOnly();
  const keys = extractionSchemaFieldKeys(schema);
  assert.deepEqual(keys.sort(), ["address", "email", "phone"]);
  const desc = buildDynamicExtractionSchema(schema);
  assert.equal(desc.length, 3);
  assert.ok(desc.every((d) => d.label && d.requirement && d.type));
  console.log("PASS A_dynamic_builtin_schema");
}

// B — custom fields appear automatically (five fields)
{
  const schema = schemaWithCustom();
  const keys = extractionSchemaFieldKeys(schema).sort();
  assert.deepEqual(keys, ["address", "dinosaury", "email", "mother_s_name", "phone"]);
  console.log("PASS B_dynamic_custom_schema_five_fields");
}

// C — arbitrary new field without code change
{
  const schema = intakeSchemaFromWizardOnly(
    { fields: { email: { enabled: true, requirementLevel: "OPTIONAL" } } },
    [
      {
        id: "favorite_spaceship",
        enabled: true,
        required: false,
        label: "Favorite spaceship",
        askWhen: "always",
      },
    ],
  );
  assert.ok(extractionSchemaFieldKeys(schema).includes("favorite_spaceship"));
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "favorite_spaceship",
          status: "FOUND",
          value: "Millennium Falcon",
          confidence: 0.9,
          evidence: [{ speaker: "CALLER", text: "Millennium Falcon" }],
        },
      ],
    },
    schema,
  );
  assert.equal(fixture?.fields.find((f) => f.fieldKey === "favorite_spaceship")?.value, "Millennium Falcon");
  console.log("PASS C_arbitrary_favorite_spaceship");
}

// D — context-dependent bare answer
{
  const schema = schemaWithCustom();
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "mother_s_name",
          status: "FOUND",
          value: "Susan",
          confidence: 0.91,
          evidence: [{ speaker: "CALLER", text: "Susan." }],
        },
      ],
    },
    schema,
  );
  const candidates = structuredRowsToPostCallCandidates(fixture!.fields);
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: { intakeSchema: schema, intakeState: {} },
    transcript: transcriptMotherSusan,
    candidates,
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Susan");
  console.log("PASS D_context_bare_answer");
}

// E — latest correction Patricia → Patrice
{
  const schema = schemaWithCustom();
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "mother_s_name",
          status: "FOUND",
          value: "Patrice",
          confidence: 0.93,
          evidence: [{ speaker: "CALLER", text: "Actually, it's Patrice." }],
          isExplicitCorrection: true,
        },
      ],
    },
    schema,
  );
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: { value: "Patricia", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    },
    transcript: {
      ...transcriptMotherSusan,
      fullText:
        "Caller: My mother's name is Patricia.\nCaller: Actually, it's Patrice.",
      callerText: "My mother's name is Patricia. Actually, it's Patrice.",
    },
    candidates: structuredRowsToPostCallCandidates(fixture!.fields),
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patrice");
  console.log("PASS E_correction_patrice");
}

// F — ambiguous
{
  const schema = schemaWithCustom();
  const candidates = structuredRowsToPostCallCandidates([
    {
      fieldKey: "mother_s_name",
      status: "AMBIGUOUS",
      confidence: 0.4,
      evidence: [{ speaker: "CALLER", text: "conflicting audio" }],
    },
  ]);
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: { value: "Patricia", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    },
    transcript: transcriptMotherSusan,
    candidates,
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patricia");
  assert.ok(reconciled.needsReview);
  console.log("PASS F_ambiguous_review");
}

// G — NOT_FOUND absent value
{
  const schema = schemaWithCustom();
  const fixture = parseStructuredExtractionJson({ fields: [] }, schema);
  const row = fixture!.fields.find((f) => f.fieldKey === "dinosaury");
  assert.equal(row?.status, "NOT_FOUND");
  console.log("PASS G_not_found");
}

// H — enum / invalid → AMBIGUOUS (simulated custom enum via allowed answer mismatch)
{
  const schema = intakeSchemaFromWizardOnly(
    {
      fields: {
        name: { enabled: false, requirementLevel: "OPTIONAL" },
        email: { enabled: false, requirementLevel: "OPTIONAL" },
        phone: { enabled: false, requirementLevel: "OPTIONAL" },
        address: { enabled: false, requirementLevel: "OPTIONAL" },
        service_reason: { enabled: false, requirementLevel: "OPTIONAL" },
      },
    },
    [{ id: "ship_color", enabled: true, required: true, label: "Ship color", askWhen: "always" }],
  );
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "ship_color",
          status: "AMBIGUOUS",
          confidence: 0.35,
          evidence: [{ speaker: "CALLER", text: "sort of chartreuse maybe" }],
        },
      ],
    },
    schema,
  );
  assert.equal(fixture?.fields[0]?.status, "AMBIGUOUS");
  console.log("PASS H_enum_ambiguous");
}

// I — LLM failure: no candidates → reconciliation must not damage live state
{
  const schema = schemaWithCustom();
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: { value: "Patricia", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    },
    transcript: transcriptMotherSusan,
    candidates: [],
  });
  assert.equal(reconciled.reconciledIntake.mother_s_name?.value, "Patricia");
  console.log("PASS I_llm_failure_preserves_live");
}

// J — reconciliation handoff + custom dinosaury + summary
{
  const schema = schemaWithCustom();
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "dinosaury",
          status: "FOUND",
          value: "velociraptor",
          confidence: 0.92,
          evidence: [{ speaker: "CALLER", text: "My dinosaury is velociraptor." }],
        },
        {
          fieldKey: "mother_s_name",
          status: "FOUND",
          value: "Patrice",
          confidence: 0.9,
          evidence: [{ speaker: "CALLER", text: "Patrice." }],
        },
      ],
    },
    schema,
  );
  const reconciled = reconcileVoiceV2PostCallRecord({
    pinned: {
      intakeSchema: schema,
      intakeState: {
        mother_s_name: { value: "Patricia", status: "CAPTURED", source: "CALLER", updatedAt: "" },
      },
    },
    transcript: transcriptMotherSusan,
    candidates: structuredRowsToPostCallCandidates(fixture!.fields),
  });
  assert.equal(reconciled.reconciledIntake.dinosaury?.value, "velociraptor");
  const summary = buildReconciledCallSummaryText({
    intakeSchema: schema,
    reconciledIntake: reconciled.reconciledIntake,
  });
  assert.match(summary, /Patrice/i);
  assert.match(summary, /velociraptor/i);
  console.log("PASS J_reconciliation_and_summary");
}

// purple_monkey_count spoken number
{
  const schema = intakeSchemaFromWizardOnly(
    {
      fields: {
        name: { enabled: false, requirementLevel: "OPTIONAL" },
        email: { enabled: false, requirementLevel: "OPTIONAL" },
        phone: { enabled: false, requirementLevel: "OPTIONAL" },
        address: { enabled: false, requirementLevel: "OPTIONAL" },
        service_reason: { enabled: false, requirementLevel: "OPTIONAL" },
      },
    },
    [
      {
        id: "purple_monkey_count",
        enabled: true,
        required: false,
        label: "Purple monkey count",
        askWhen: "always",
      },
    ],
  );
  const fixture = parseStructuredExtractionJson(
    {
      fields: [
        {
          fieldKey: "purple_monkey_count",
          status: "FOUND",
          value: "Three",
          confidence: 0.88,
          evidence: [{ speaker: "CALLER", text: "Three." }],
        },
      ],
    },
    schema,
  );
  assert.equal(fixture?.fields[0]?.value, "3");
  console.log("PASS purple_monkey_count_normalization");
}

console.log("test-voice-v2-post-call-reconciliation-headless: ALL PASS");
