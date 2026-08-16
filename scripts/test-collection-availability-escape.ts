/**
 * Collection completion + utterance classification smoke tests.
 * Run: npx tsx scripts/test-collection-availability-escape.ts
 */
import assert from "node:assert/strict";
import {
  activateBookingWorkflow,
  bookingFieldsComplete,
  enterCollectionState,
  ensureReceptionistWorkflow,
  missingFieldsForPurpose,
  transitionAfterRecordField,
} from "../voice-runtime/src/frontdesk/receptionist/workflow-engine";
import {
  classifyCollectionUtterance,
  looksLikeAvailabilityRequest,
} from "../voice-runtime/src/frontdesk/receptionist/collection-utterance-validation";
import { persistActiveFieldAnswer } from "../voice-runtime/src/frontdesk/receptionist/process-active-field-answer";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

function baseUserData(): FrontDeskUserData {
  return {
    workspaceId: "w",
    agentId: "a",
    callId: "c",
    businessName: "Harbor Home HVAC",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistCompiled: {
      businessName: "Harbor Home HVAC",
      timezone: "America/New_York",
      greeting: "Hi",
      capabilities: ["book_appointments", "collect_info"],
      fieldManifest: [
        { id: "name", label: "name", required: true, question: "What is your name?" },
        { id: "phone", label: "phone", required: true, type: "phone", question: "Callback number?" },
        {
          id: "address",
          label: "address",
          required: true,
          question: "What is the service address?",
        },
        {
          id: "email",
          label: "email",
          required: false,
          type: "email",
          askWhen: "when_booking",
          question: "What is your email?",
        },
        { id: "reason", label: "issue", required: true, question: "What is the issue?" },
      ],
      actionPermissions: {},
      compiledPrompt: "",
    },
    receptionistFields: {},
    receptionistToolNames: ["record_current_field", "list_available_slots"],
  };
}

const ud = baseUserData();
enterCollectionState(ud, "booking");
assert.equal(ud.receptionistWorkflow?.activeFieldId, "reason");

assert.equal(
  classifyCollectionUtterance(
    "Oh, so you can't confirm the appointment?",
    { id: "email", label: "email", required: false, type: "email", question: "Email?" },
  ),
  "clarification",
);

assert.equal(
  classifyCollectionUtterance("Hello?", { id: "email", label: "email", type: "email", question: "?" }),
  "clarification",
);

assert.ok(looksLikeAvailabilityRequest("Can you check availability for tomorrow?"));
assert.equal(
  classifyCollectionUtterance(
    "Can you check availability?",
    { id: "phone", label: "phone", type: "phone", question: "Phone?" },
  ),
  "availability_request",
);

assert.equal(
  classifyCollectionUtterance(
    "Anthony Johnson",
    { id: "name", label: "name", required: true, question: "Name?" },
  ),
  "field_value",
);

const phoneField = { id: "phone", label: "phone", required: true, type: "phone" as const, question: "Phone?" };
const phoneSave = persistActiveFieldAnswer(ud, "phone", "571-477-6175", phoneField);
assert.equal(phoneSave.status, "saved");
if (phoneSave.status === "saved") {
  assert.equal(phoneSave.normalized, "+15714776175");
  assert.equal(ud.receptionistFields?.phone, "+15714776175");
}

ud.receptionistFields = {
  name: "Anthony Johnson",
  phone: "+15714776175",
  address: "12 Oak St Arlington VA",
  email: "anthony@example.com",
  reason: "AC not cooling",
};
assert.equal(missingFieldsForPurpose(ud, "booking").length, 0);
assert.equal(bookingFieldsComplete(ud), true);

transitionAfterRecordField(ud, "booking");
assert.equal(ud.receptionistWorkflow?.state, "BOOKING_CHECK_AVAILABILITY");
assert.equal(ud.receptionistWorkflow?.activeFieldId, undefined);

console.log("✓ collection availability escape tests passed");
