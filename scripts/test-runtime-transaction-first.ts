/**
 * Transaction-first critical write contracts (booking, cancel, reschedule, transfer).
 * Run: npx tsx scripts/test-runtime-transaction-first.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const scheduleRuntime = read("voice-runtime/src/frontdesk/runtime-schedule-appointment.ts");
const cancelTool = read("voice-runtime/src/frontdesk/cancel-appointment-tool.ts");
const rescheduleTool = read("voice-runtime/src/frontdesk/reschedule-appointment-tool.ts");
const transferTool = read("voice-runtime/src/frontdesk/transfer-tool.ts");
const bookingWrite = read("voice-runtime/src/frontdesk/booking-provider-write.ts");
const cancelWrite = read("voice-runtime/src/frontdesk/cancel-provider-write.ts");
const rescheduleWrite = read("voice-runtime/src/frontdesk/reschedule-provider-write.ts");
const transferWrite = read("voice-runtime/src/frontdesk/transfer-provider-write.ts");
const bookingSms = read("voice-runtime/src/frontdesk/booking-sms.ts");
const transaction = read("voice-runtime/src/frontdesk/runtime-transaction.ts");

// --- shared speech guard ---
assert.ok(transaction.includes("tryConfirmationSpeech"));
assert.ok(transaction.includes("_confirmation_speech_skipped"));
assert.ok(transaction.includes("durableCallWorkContextFromUserData"));

// --- booking commit ---
assert.ok(scheduleRuntime.includes("writeBookingToProvider"));
assert.ok(!scheduleRuntime.includes("runAsyncWorkWithBridge"));
assert.ok(bookingWrite.includes("booking_write_started"));
assert.ok(bookingWrite.includes("booking_write_succeeded"));
assert.ok(scheduleRuntime.includes("booking_receipt_persisted"));

// --- cancel ---
assert.ok(cancelTool.includes("writeCancelToProvider"));
assert.ok(!cancelTool.includes("runAsyncWorkWithBridge"));
assert.ok(cancelWrite.includes("cancel_write_started"));
assert.ok(cancelWrite.includes("cancel_receipt_persisted"));
assert.ok(
  cancelTool.indexOf("writeCancelToProvider") < cancelTool.indexOf("tryConfirmationSpeech"),
  "cancel provider write before speech",
);

// --- reschedule ---
assert.ok(rescheduleTool.includes("writeRescheduleToProvider"));
assert.ok(!rescheduleTool.includes("runAsyncWorkWithBridge"));
assert.ok(rescheduleWrite.includes("reschedule_write_started"));
assert.ok(rescheduleWrite.includes("reschedule_receipt_persisted"));
assert.ok(
  rescheduleTool.indexOf("writeRescheduleToProvider") <
    rescheduleTool.indexOf("tryConfirmationSpeech"),
  "reschedule provider write before speech",
);

// --- transfer ---
assert.ok(transferTool.includes("writeTransferToProvider"));
assert.ok(transferWrite.includes("transfer_write_started"));
assert.ok(transferWrite.includes("transfer_receipt_persisted"));
assert.ok(transferWrite.includes("alreadyTransferred"));
const transferExecute = transferTool.match(/execute: async[\s\S]*?}\s*,\s*}\);/);
assert.ok(transferExecute, "transfer execute block");
assert.ok(
  transferExecute![0].indexOf("writeTransferToProvider") <
    transferExecute![0].indexOf("tryConfirmationSpeech"),
  "transfer initiate before bridge speech",
);

// --- SMS uses durable context, not session ---
assert.ok(bookingSms.includes("durableCallWorkContextFromUserData"));
assert.ok(bookingSms.includes("sendBookingSmsAsync(userData"));
assert.ok(!bookingSms.match(/sendBookingSmsAsync\(\s*session/));

console.log("runtime transaction-first tests: PASS");
