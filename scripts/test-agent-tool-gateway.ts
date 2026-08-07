/**
 * Agent Tool Gateway unit checks — normalization, envelope, slot guard.
 * Run: npx tsx scripts/test-agent-tool-gateway.ts
 */
import assert from "node:assert/strict";
import {
  normalizeBookInput,
  normalizeAvailabilityInput,
  validateBookInput,
  bookInputToLegacyArgs,
  availabilityInputToLegacyArgs,
} from "../src/lib/voice/agent-tool-gateway/normalize";
import { toolSuccess, toLegacyVoiceShape } from "../src/lib/voice/agent-tool-gateway/envelope";
import { AgentToolError, failResult, translateError } from "../src/lib/voice/agent-tool-gateway/errors";
import { isGatewayRoutedTool } from "../src/lib/voice/agent-tool-gateway/gateway";
import { assertStartsAtMatchesAvailabilitySlots } from "../src/lib/voice/calendar/booking-args";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

check("routes book + availability aliases", isGatewayRoutedTool("book_appointment"));
check("routes check_availability alias", isGatewayRoutedTool("check_availability"));
check("does not route unrelated tools", !isGatewayRoutedTool("send_sms"));

const book = normalizeBookInput(
  {
    startsAt: "2026-08-07T13:00:00.000Z",
    customerName: "Anthony Johnson",
    customerPhone: "+15714776175",
    customerEmail: "caller@example.com",
    serviceName: "Service Visit",
    timezone: "America/New_York",
  },
  { callId: "call_test_1" },
);
check("book operation_id derived from call", book.operation_id.includes("call_test_1"));
check("book start_time normalized", book.start_time === "2026-08-07T13:00:00.000Z");
check("book phone E164", book.customer_phone === "+15714776175");
validateBookInput(book);

const legacy = bookInputToLegacyArgs(book, { callId: "call_test_1" });
check("legacy args startsAt", legacy.startsAt === book.start_time);

const avail = normalizeAvailabilityInput({
  serviceName: "Service Visit",
  from: "2026-08-07T21:00:00.000Z",
  to: "2026-08-07T21:00:00.000Z",
  resolvedIso: "2026-08-07T21:00:00.000Z",
});
const availLegacy = availabilityInputToLegacyArgs(avail);
check("availability legacy from resolved", availLegacy.from === "2026-08-07T21:00:00.000Z");

const slots = ["2026-08-07T13:00:00.000Z", "2026-08-07T14:00:00.000Z"];
assertStartsAtMatchesAvailabilitySlots("2026-08-07T13:00:00.000Z", slots);
check("slot guard accepts offered slot", true);
try {
  assertStartsAtMatchesAvailabilitySlots("2026-08-07T17:00:00.000Z", slots);
  check("slot guard rejects invented time", false, "should have thrown");
} catch {
  check("slot guard rejects invented time", true);
}

const success = toolSuccess({
  status: "confirmed",
  user_message: "Appointment confirmed.",
  operation_id: "op-1",
  data: { appointment_id: "appt_1", may_confirm_to_caller: true },
});
const legacyShape = toLegacyVoiceShape(success);
check("legacy shape ok", legacyShape.ok === true && legacyShape.status === "confirmed");
check("legacy shape spreads data", legacyShape.appointment_id === "appt_1");

const err = new AgentToolError("SLOT_NOT_IN_AVAILABILITY", "bad slot", false, "Pick another time.");
const failed = failResult(err, "op-2");
check("fail envelope", failed.success === false && failed.error_code === "SLOT_NOT_IN_AVAILABILITY");
const translated = translateError(new Error("supplied parameters are invalid"));
check("translates calendly invalid", translated.code === "INVALID_INPUT");

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${failures.length === 0 ? "checks" : ""} passed.`);
