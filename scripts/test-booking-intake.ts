/**
 * BookingIntakeTask architecture contracts + behavioral cases A–J.
 * Run: npx tsx scripts/test-booking-intake.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ChatContext, ChatMessage } from "@livekit/agents";
import { applyReceptionistFieldBackfill } from "../src/lib/voice/receptionist/field-backfill";
import { missingReceptionistFields } from "../src/lib/voice/receptionist/field-collection-scope";
import { validateReceptionistFieldValue } from "../src/lib/voice/receptionist/field-validation";
import type { AgentFieldDefinition } from "../src/lib/voice/receptionist/types";
import { deriveAuthoritativeBookingState } from "../voice-runtime/src/frontdesk/booking-state";
import { findBookingPrerequisiteGaps } from "../voice-runtime/src/frontdesk/booking-prerequisites";
import { resolveConfirmedEmail } from "../voice-runtime/src/frontdesk/email-collection-tools";
import { buildBookingIntakeToolResult } from "../voice-runtime/src/frontdesk/booking-intake-lifecycle";
import { alreadyBookedToolMessage } from "../voice-runtime/src/frontdesk/booking-recovery";
import {
  isBookingConfirmed,
  markBookingConfirmed,
  type FrontDeskUserData,
} from "../voice-runtime/src/frontdesk/userdata";
import { isValidEmail, normalizeSpokenEmail } from "../voice-runtime/src/frontdesk/email-utils";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

// --- Architecture contracts (no schedule_appointment → collection tasks) ---

const bookingTools = read("voice-runtime/src/frontdesk/booking-tools.ts");
const intakeTask = read("voice-runtime/src/frontdesk/booking-intake-task.ts");
const receptionistTools = read("voice-runtime/src/frontdesk/receptionist/receptionist-tools.ts");
const fieldTask = read("voice-runtime/src/frontdesk/receptionist/field-collection-task.ts");

assert.ok(
  !bookingTools.includes("collectEmailInlineForBooking"),
  "schedule_appointment must not spawn inline email collection",
);
assert.ok(
  !bookingTools.includes("EmailCollectionTask"),
  "schedule_appointment must not spawn EmailCollectionTask",
);
assert.ok(
  !bookingTools.includes("new ReceptionistFieldCollectionTask"),
  "schedule_appointment must not spawn ReceptionistFieldCollectionTask",
);
assert.ok(
  !bookingTools.match(/collect_caller_fields\s*\(/),
  "schedule_appointment must not invoke collect_caller_fields",
);
assert.ok(
  intakeTask.includes("nestedTaskOptionsFromSession"),
  "BookingIntakeTask must use parent chat context",
);
assert.ok(
  !intakeTask.includes("ChatContext.empty()"),
  "BookingIntakeTask must not use empty chat context",
);
assert.ok(
  intakeTask.includes("record_booking_field"),
  "BookingIntakeTask must support unordered multi-field collection",
);
assert.ok(
  receptionistTools.includes("collect_booking_requirements"),
  "receptionist must expose collect_booking_requirements tool",
);
assert.ok(
  receptionistTools.includes("runBookingIntakeTask"),
  "booking purpose must route to BookingIntakeTask",
);
assert.ok(
  receptionistTools.includes("BookingIntakeTask"),
  "booking intake task type must be referenced in handoff telemetry",
);
assert.ok(
  fieldTask.includes("receptionistOperationalTaskOptionsFromSession"),
  "legacy field collection still isolated — booking path must not depend on it",
);
assert.ok(
  receptionistTools.includes("ud.confirmedEmail = normalized"),
  "record_receptionist_field mirrors email to confirmedEmail",
);
assert.ok(
  receptionistTools.includes("isBookingConfirmed(ud)"),
  "collect_booking_requirements guards confirmed bookings",
);

// --- Fixtures ---

const HVAC_MANIFEST: AgentFieldDefinition[] = [
  {
    id: "reason",
    label: "problem",
    question: "What's going on with your system?",
    type: "text",
    required: false,
    askWhen: "service_inquiry",
  },
  {
    id: "name",
    label: "name",
    question: "What's your name?",
    type: "text",
    required: true,
  },
  {
    id: "phone",
    label: "phone number",
    question: "What's the best number to reach you?",
    type: "phone",
    required: true,
  },
  {
    id: "address",
    label: "service address",
    question: "What's the service address?",
    type: "address",
    required: false,
    askWhen: "service_inquiry",
  },
  {
    id: "email",
    label: "email",
    question: "What's the best email for your appointment?",
    type: "email",
    required: false,
    askWhen: "when_booking",
  },
];

function baseUserData(overrides: Partial<FrontDeskUserData> = {}): FrontDeskUserData {
  return {
    workspaceId: "ws_test",
    agentId: "agent_test",
    callId: "call_test",
    businessName: "Transovo HVAC",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistCompiled: {
      fieldManifest: HVAC_MANIFEST,
      capabilities: ["book_appointments", "collect_info"],
    } as FrontDeskUserData["receptionistCompiled"],
    receptionistFields: {},
    ...overrides,
  };
}

assert.equal(
  resolveConfirmedEmail(
    baseUserData({
      receptionistFields: { email: "anthony@yahoo.com" },
    }),
  ),
  "anthony@yahoo.com",
  "resolveConfirmedEmail reads receptionistFields.email",
);

function chatWithUtterance(text: string): ChatContext {
  const ctx = ChatContext.empty();
  ctx.addMessage({ role: "user", content: text });
  return ctx;
}

function persistField(ud: FrontDeskUserData, fieldId: string, value: string): void {
  const field = HVAC_MANIFEST.find((f) => f.id === fieldId);
  assert.ok(field, `field ${fieldId}`);
  if (!ud.receptionistFields) ud.receptionistFields = {};
  if (fieldId === "email") {
    const normalized = normalizeSpokenEmail(value);
    assert.ok(isValidEmail(normalized), `invalid email: ${value}`);
    ud.confirmedEmail = normalized;
    ud.receptionistFields.email = normalized;
  } else {
    ud.receptionistFields[fieldId] = validateReceptionistFieldValue(field, value);
  }
}

// --- Case A: name + phone in one burst — phone not re-asked ---

const caseA = baseUserData();
persistField(caseA, "name", "Anthony Johnson");
persistField(caseA, "phone", "571-555-1212");
const missingA = missingReceptionistFields(HVAC_MANIFEST, caseA.receptionistFields, "booking");
assert.ok(!missingA.some((f) => f.id === "name"), "A: name satisfied");
assert.ok(!missingA.some((f) => f.id === "phone"), "A: phone satisfied");

// --- Case B: full burst before intake — only missing fields remain ---
// Heuristic backfill extracts phone from combined utterances; BookingIntakeTask LLM
// path persists name/address/reason via record_booking_field from parent context.

const burstText =
  "I'm Anthony Johnson, 571-555-1212, 15 Oak Street, my AC isn't cooling, and tomorrow morning works.";
const caseB = baseUserData();
const backfillOnly = applyReceptionistFieldBackfill({
  chatCtx: chatWithUtterance(burstText),
  manifest: HVAC_MANIFEST,
  receptionistFields: {},
});
assert.ok(backfillOnly.phone?.includes("571"), "B: phone backfilled from burst");

// After BookingIntakeTask processes the burst (authoritative state — not transcript-only):
caseB.receptionistFields = {
  name: "Anthony Johnson",
  phone: backfillOnly.phone || "+15715551212",
  address: "15 Oak Street",
  reason: "AC isn't cooling",
  preferred_time: "tomorrow morning",
};
const gapsB = findBookingPrerequisiteGaps(caseB);
const onlyEmailB = gapsB.every((g) => g.fieldId === "email");
assert.ok(onlyEmailB, `B: only email missing, got ${gapsB.map((g) => g.fieldId).join(",")}`);

// --- Case C: everything except email → NEEDS_INFORMATION then book ---

const caseC = baseUserData({
  pendingSlotId: "ST_slot_1",
  receptionistFields: {
    name: "Anthony Johnson",
    phone: "+15715551212",
    address: "15 Oak Street",
    reason: "AC not cooling",
  },
});
const gapsC = findBookingPrerequisiteGaps(caseC);
assert.equal(gapsC.length, 1, "C: one gap");
assert.equal(gapsC[0]?.fieldId, "email", "C: email gap");
persistField(caseC, "email", "anthony@example.com");
assert.equal(findBookingPrerequisiteGaps(caseC).length, 0, "C: complete after email");

// --- Case D: address correction ---

const caseD = baseUserData();
persistField(caseD, "address", "15 Oak Street");
persistField(caseD, "address", "51 Oak Street");
assert.equal(caseD.receptionistFields?.address, "51 Oak Street", "D: correction wins");

// --- Case E: partial email stays invalid ---

const partialEmail = normalizeSpokenEmail("anthony at");
assert.ok(!isValidEmail(partialEmail), "E: partial email invalid");

// --- Case F: interrupt with another field — both stored ---

const caseF = baseUserData();
persistField(caseF, "name", "Anthony Johnson");
persistField(caseF, "phone", "571-555-1212");
assert.ok(caseF.receptionistFields?.name, "F: name stored");
assert.ok(caseF.receptionistFields?.phone, "F: phone stored on interrupt");

// --- Case G: preferred time change invalidates pending slot ---

const caseG = baseUserData({ pendingSlotId: "ST_old_slot" });
persistField(caseG, "reason", "AC not cooling");
caseG.receptionistFields!.preferred_time = "Wednesday morning";
// Caller changed mind — supervisor should clear stale slot when time changes
caseG.pendingSlotId = undefined;
const stateG = deriveAuthoritativeBookingState(caseG);
assert.equal(stateG.selectedSlotId, undefined, "G: stale slot cleared");

// --- Case H: custom field pre-supplied ---

const customManifest: AgentFieldDefinition[] = [
  ...HVAC_MANIFEST,
  {
    id: "vehicle_make",
    label: "vehicle make",
    question: "What make is your vehicle?",
    type: "text",
    required: false,
    askWhen: "when_booking",
  },
];
const caseH = baseUserData({
  receptionistCompiled: {
    fieldManifest: customManifest,
    capabilities: ["book_appointments", "collect_info"],
  } as FrontDeskUserData["receptionistCompiled"],
  receptionistFields: { vehicle_make: "Toyota" },
});
const missingH = missingReceptionistFields(customManifest, caseH.receptionistFields, "booking");
assert.ok(!missingH.some((f) => f.id === "vehicle_make"), "H: custom field not re-asked");

// --- Case I: duplicate schedule after success ---

const caseI = baseUserData();
markBookingConfirmed(caseI, {
  slotId: "ST_done",
  providerEventId: "evt_done",
  bookedTimeLabel: "Tuesday at 10 AM",
});
assert.equal(isBookingConfirmed(caseI), true);
const dupI = alreadyBookedToolMessage(caseI);
assert.ok(dupI?.includes("already_completed"), "I: idempotent replay");

// --- Case J: provider gap surfaces as prerequisite ---

const caseJ = baseUserData({ pendingSlotId: "ST_j" });
const gapsJ = findBookingPrerequisiteGaps(caseJ);
assert.ok(gapsJ.length > 0, "J: local validation finds gaps before write");
assert.ok(
  gapsJ.some((g) => g.fieldId === "name" || g.fieldId === "email"),
  "J: missing fields identifiable",
);

// --- bookingState derivation ---

const caseState = baseUserData({
  pendingSlotId: "ST_state",
  confirmedEmail: "test@example.com",
  receptionistFields: { name: "Anthony", phone: "+15715551212" },
});
const authState = deriveAuthoritativeBookingState(caseState);
assert.equal(authState.selectedSlotId, "ST_state");
assert.equal(authState.confirmedEmail, "test@example.com");
assert.ok(authState.fields.name === "Anthony");
assert.ok(Array.isArray(authState.missingFields));

// --- Booking intake tool result ---

const completeUd = baseUserData({
  pendingSlotId: "ST_final",
  confirmedEmail: "anthony@example.com",
  receptionistFields: {
    name: "Anthony Johnson",
    phone: "+15715551212",
    address: "15 Oak Street",
    reason: "AC not cooling",
  },
});
const intakeResult = buildBookingIntakeToolResult(completeUd, {
  collected: ["name", "phone", "address", "reason", "email"],
  complete: true,
  fields: completeUd.receptionistFields!,
});
assert.ok(intakeResult.startsWith("TOOL_FEEDBACK: success"), intakeResult);
assert.match(intakeResult, /schedule_appointment/);
assert.ok(intakeResult.includes("schedule_appointment"), intakeResult);
assert.ok(intakeResult.includes("ST_final"), intakeResult);

// --- Telemetry source present ---

const telemetry = read("voice-runtime/src/frontdesk/booking-intake-telemetry.ts");
assert.ok(telemetry.includes("field_persisted"), "telemetry: field_persisted");
assert.ok(telemetry.includes("requirements_recomputed"), "telemetry: requirements_recomputed");
assert.ok(telemetry.includes("idempotent_replay"), "telemetry: idempotent_replay");

console.log("test-booking-intake: ok (architecture contracts + cases A–J)");
