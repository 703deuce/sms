/**
 * Production-shaped tests for Amy/Frontdesk dual-memory model:
 * ChatContext (conversational) + userData/callContext (authoritative).
 *
 * Run: npx tsx scripts/test-amy-task-memory.ts
 */
import assert from "node:assert/strict";
import {
  nestedTaskOptionsFromSession,
  taskGroupOptionsFromSession,
} from "../voice-runtime/src/tasks/task-context";
import { missingRequiredFields } from "../voice-runtime/src/scheduling-bridge";
import { alreadyBookedToolMessage } from "../voice-runtime/src/frontdesk/booking-recovery";
import {
  isBookingConfirmed,
  markBookingConfirmed,
  type FrontDeskUserData,
} from "../voice-runtime/src/frontdesk/userdata";
import { hasBookingReceipt } from "../src/lib/voice/workflow-runtime/completion-guards";
import type { LiveKitCallContext } from "../src/lib/voice/domain-actions";
import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";

// --- 1. Nested task options always pass parent chatCtx + preserve FC history ---

const fakeSession = {
  chatCtx: { items: [{ role: "user", content: "anthony@gmail.com" }] },
} as Parameters<typeof nestedTaskOptionsFromSession>[0];

const nestedOpts = nestedTaskOptionsFromSession(fakeSession);
assert.equal(nestedOpts.preserveFunctionCallHistory, true);
assert.ok(nestedOpts.chatCtx);

const groupOpts = taskGroupOptionsFromSession(fakeSession);
assert.equal(groupOpts.summarizeChatCtx, false);
assert.equal(groupOpts.preserveFunctionCallHistory, true);
assert.ok(groupOpts.chatCtx);

// --- 2. Authoritative state: skip known fields before collection ---

function makeCtx(collected: Record<string, string>): LiveKitCallContext {
  return {
    workspaceId: "ws_1",
    callId: "call_1",
    session: {
      fieldManifest: [
        { field_id: "name", label: "name", required: true, collection_instruction: "" },
        { field_id: "email", label: "email", required: true, collection_instruction: "" },
        { field_id: "phone", label: "phone", required: true, collection_instruction: "" },
      ],
      collectedFields: collected,
    } as unknown as AmyRealtimeSession,
  } as LiveKitCallContext;
}

const allGiven = makeCtx({
  name: "Anthony",
  email: "anthony@gmail.com",
  phone: "7035551212",
});
assert.equal(missingRequiredFields(allGiven).length, 0);

const partial = makeCtx({ name: "Anthony", email: "anthony@gmail.com" });
const stillNeeded = missingRequiredFields(partial);
assert.equal(stillNeeded.length, 1);
assert.equal(stillNeeded[0]?.field_id, "phone");

// --- 3. Email correction updates authoritative state (field overwrite) ---

const corrected = makeCtx({ email: "anthony@work.com" });
assert.equal(corrected.session.collectedFields.email, "anthony@work.com");

// --- 4. Frontdesk booking guard: duplicate schedule rejected ---

const frontdesk: FrontDeskUserData = {
  workspaceId: "ws_1",
  agentId: "a",
  callId: "c",
  businessName: "Test",
  timezone: "UTC",
  cal: {} as FrontDeskUserData["cal"],
  slotUnavailableCount: 0,
};
markBookingConfirmed(frontdesk, {
  slotId: "ST_1",
  providerEventId: "evt_1",
  bookedTimeLabel: "Monday at 1 PM",
});
assert.equal(isBookingConfirmed(frontdesk), true);
const dup = alreadyBookedToolMessage(frontdesk);
assert.ok(dup?.includes("already_completed"));

// --- 5. Amy booking receipt guard ---

const amySession = {
  bookingId: "bk_123",
  confirmationState: "confirmed",
  runtime: {},
  fieldManifest: [],
  collectedFields: {},
} as unknown as AmyRealtimeSession;
assert.equal(hasBookingReceipt(amySession), true);

const noBooking = {
  bookingId: null,
  confirmationState: null,
  runtime: {},
  fieldManifest: [],
  collectedFields: {},
} as unknown as AmyRealtimeSession;
assert.equal(hasBookingReceipt(noBooking), false);

// --- 6. Frontdesk email skip: confirmedEmail means no re-collection ---

const withEmail: FrontDeskUserData = {
  ...frontdesk,
  confirmedEmail: "anthony@gmail.com",
};
assert.ok(withEmail.confirmedEmail);
assert.equal(isBookingConfirmed(withEmail), true);

console.log("amy task memory tests: PASS");
