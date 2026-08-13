/**
 * Prove agent-wizard E2E product contracts (compile, presets, catalog, nav, naming).
 * Run: npx tsx scripts/test-agent-wizard-e2e.ts
 */

import assert from "assert";
import {
  buildVoiceAgentPrimaryDefinition,
  VOICE_TEMPLATE_KEYS,
  VOICE_MANAGED_TEMPLATE_KEYS,
} from "../src/lib/agents/compile-workflow";
import { reconcileManagedNodes } from "../src/lib/agents/workflows";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";
import { solutionsNav } from "../src/lib/solutions-nav";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  allowedCapabilitiesForPreset,
  capabilityOptionsForPreset,
  hasBookingCapability,
  testScenariosForCapabilities,
  uniqueAgentDisplayName,
  visibleWizardSteps,
} from "../src/lib/solutions/appointment-receptionist/wizard-presets";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";

// --- 1. Capabilities filtered by agent type ---
const answeringCaps = allowedCapabilitiesForPreset("every_call");
assert.ok(!answeringCaps.includes("book_appointments"));
assert.ok(!answeringCaps.includes("reschedule"));
assert.ok(!answeringCaps.includes("cancel"));
assert.ok(answeringCaps.includes("answer_questions"));

const overflowCaps = allowedCapabilitiesForPreset("nobody_answers");
assert.ok(
  !overflowCaps.includes("book_appointments"),
  "Cover missed calls must not offer booking by default",
);

const afterHoursCaps = allowedCapabilitiesForPreset("after_hours");
assert.ok(!afterHoursCaps.includes("book_appointments"));

const bookingCaps = allowedCapabilitiesForPreset("appointment_booking");
assert.ok(bookingCaps.includes("book_appointments"));
assert.ok(bookingCaps.includes("reschedule"));

assert.equal(
  capabilityOptionsForPreset("every_call").length,
  answeringCaps.length,
);

// --- 2. Wizard steps differ by type ---
const answeringState = applyWizardPreset(createDefaultWizardState(), "every_call");
const answeringSteps = visibleWizardSteps(answeringState).map((s) => s.id);
assert.ok(!answeringSteps.includes("appointments"));
assert.ok(answeringSteps.includes("information"));
assert.ok(answeringSteps.includes("activate"));

const bookingState = createDefaultWizardState();
assert.ok(hasBookingCapability(bookingState.capabilities));
assert.ok(
  visibleWizardSteps(bookingState)
    .map((s) => s.id)
    .includes("appointments"),
);

// --- 3. Test scenarios differ ---
const answeringScenarios = testScenariosForCapabilities(answeringState.capabilities);
assert.ok(!answeringScenarios.some((s) => s.id === "appointment_booking"));
const bookingScenarios = testScenariosForCapabilities(bookingState.capabilities);
assert.ok(bookingScenarios.some((s) => s.id === "appointment_booking"));

// --- 4. Compiled workflow differs by agent type ---
const answeringFlow = buildVoiceAgentPrimaryDefinition({
  agentName: "Answering",
  agentId: "agent_a",
  phoneNumberId: "pn_1",
  phoneNumberE164: "+15551234567",
  includeBookingBranches: false,
  includeSmsConfirmation: false,
});
const bookingFlow = buildVoiceAgentPrimaryDefinition({
  agentName: "Booking",
  agentId: "agent_b",
  phoneNumberId: "pn_1",
  phoneNumberE164: "+15551234567",
  includeBookingBranches: true,
  includeSmsConfirmation: true,
});

assert.ok(
  !answeringFlow.edges.some((e) => e.sourceHandle === "booked"),
  "answering graph must omit booked branch",
);
assert.ok(
  bookingFlow.edges.some((e) => e.sourceHandle === "booked"),
  "booking graph must include booked branch",
);
assert.ok(
  bookingFlow.nodes.some((n) => n.data.blockType === "send_sms"),
  "booking+SMS graph includes confirmation SMS node",
);
assert.ok(
  !answeringFlow.nodes.some((n) => n.data.blockType === "send_sms"),
  "answering graph must not include booking SMS",
);
assert.notEqual(
  answeringFlow.nodes.length,
  bookingFlow.nodes.length,
  "booking and answering graphs must not be identical",
);

// Reconcile strips booking SMS when booking turned off
const stripped = reconcileManagedNodes(
  bookingFlow,
  answeringFlow,
  VOICE_MANAGED_TEMPLATE_KEYS,
);
assert.ok(
  !stripped.nodes.some((n) => n.data.templateNodeKey === VOICE_TEMPLATE_KEYS.SEND_BOOKING_SMS),
  "reconcile must drop send_booking_sms when booking off",
);

// --- 5. Catalog blocks searchable ---
const requiredBlocks = ["inbound_call", "run_voice_agent", "wait_for_call_result"];
for (const blockType of requiredBlocks) {
  const block = AUTOMATION_BLOCKS.find((b) => b.blockType === blockType);
  assert.ok(block, `${blockType} must be in catalog`);
  assert.ok(
    (block!.searchTerms || []).length > 0,
    `${blockType} must have searchTerms`,
  );
}

// --- 6. Nav: flat mockup sidebar centers on My Receptionist ---
assert.equal(solutionsNav[0]?.label, "Dashboard");
assert.equal(solutionsNav[1]?.label, "My Receptionist");
assert.equal(solutionsNav[2]?.label, "Phone Numbers");
assert.equal(solutionsNav[3]?.label, "Settings");

// --- 7. Unique naming ---
const n1 = uniqueAgentDisplayName("AI Answering Agent", "01-01 10:00");
const n2 = uniqueAgentDisplayName("AI Answering Agent", "01-01 10:01");
assert.notEqual(n1, n2);
assert.ok(n1.includes("AI Answering Agent"));

// --- 8. Wizard fields persist into draftConfig ---
const rich = applyWizardPreset(
  {
    ...createDefaultWizardState(),
    businessName: "Acme Dental",
    websiteUrl: "https://acme.example",
    knowledgeItems: [
      {
        id: "hours",
        label: "Hours",
        summary: "Mon-Fri 9-5",
        status: "complete",
        statusLabel: "Configured",
      },
    ],
    transferDestinationPhone: "+15559876543",
    transferDestinationName: "Front desk",
  },
  "every_call",
);
const cfg = buildWizardAgentConfig(rich);
assert.ok(cfg.instructions?.system?.includes("Acme Dental") || JSON.stringify(cfg).includes("Acme Dental"));
const snap = (cfg.advanced as { appointmentReceptionistWizard?: Record<string, unknown> })
  ?.appointmentReceptionistWizard;
assert.ok(snap, "draftConfig must embed wizard snapshot");
assert.equal(snap.businessName, "Acme Dental");
assert.ok(
  Array.isArray(snap.knowledgeItems) &&
    (snap.knowledgeItems as Array<{ summary?: string }>).some(
      (i) => i.summary === "Mon-Fri 9-5",
    ),
  "hours knowledge must persist in wizard snapshot",
);

console.log("test-agent-wizard-e2e: all assertions passed");
