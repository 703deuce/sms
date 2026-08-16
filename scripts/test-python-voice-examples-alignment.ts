/**
 * Static alignment checks: Transovo Python voice runtime vs LiveKit Agents examples.
 * Run: npx tsx scripts/test-python-voice-examples-alignment.ts
 *
 * Reference examples: /agent/repos/agents/examples/
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const smsRoot = process.cwd();
const agentsRoot = path.join(smsRoot, "..", "agents");

function readSms(rel: string): string {
  return fs.readFileSync(path.join(smsRoot, rel), "utf8");
}

function readAgents(rel: string): string {
  const p = path.join(agentsRoot, rel);
  if (!fs.existsSync(p)) {
    console.warn(`skip agents example (missing): ${rel}`);
    return "";
  }
  return fs.readFileSync(p, "utf8");
}

const inbound = readSms("voice-runtime-python/transovo_voice/session/inbound.py");
const transfer = readSms("voice-runtime-python/transovo_voice/agent/transfer_tool.py");
const tools = readSms("voice-runtime-python/transovo_voice/agent/tools.py");
const intake = readSms("voice-runtime-python/transovo_voice/workflows/booking_intake.py");
const amy = readSms("voice-runtime-python/transovo_voice/agent/amy.py");
const main = readSms("voice-runtime-python/transovo_voice/main.py");

const warmTransfer = readAgents("examples/warm-transfer/warm_transfer.py");
const frontdesk = readAgents("examples/frontdesk/agent.py");
const healthcare = readAgents("examples/healthcare/agent.py");
const survey = readAgents("examples/survey/agent.py");
const hotel = readAgents("examples/hotel_receptionist/agent.py");

// AgentServer + rtc_session entry (all examples)
assert.ok(main.includes("AgentServer"), "main uses AgentServer");
assert.ok(main.includes("@server.rtc_session"), "main uses rtc_session decorator");

// ctx.connect before session.start (frontdesk, hotel — not survey's late connect)
assert.ok(
  inbound.indexOf("await ctx.connect()") < inbound.indexOf("await session.start("),
  "inbound: ctx.connect before session.start",
);
assert.ok(inbound.includes("wait_for_participant"), "inbound waits for SIP participant");
assert.ok(inbound.includes("add_shutdown_callback"), "inbound registers shutdown callback");

// Warm transfer pattern (warm-transfer + healthcare)
if (warmTransfer) {
  assert.ok(transfer.includes("WarmTransferTask"), "transfer uses WarmTransferTask");
  assert.ok(transfer.includes("sip_call_to"), "transfer uses sip_call_to (SDK canonical param)");
  assert.ok(transfer.includes("allow_interruptions=False"), "transfer hold line is non-interruptible");
  assert.ok(transfer.includes("session.shutdown()"), "transfer shuts down session after success");
  assert.ok(
    inbound.includes("delete_room_on_close=not ud.can_transfer()"),
    "inbound keeps room open when transfer capable (warm-transfer delete_room_on_close=False)",
  );
}

// TaskGroup intake (survey + healthcare)
assert.ok(intake.includes("TaskGroup"), "intake uses TaskGroup");
assert.ok(intake.includes("GetNameTask"), "intake uses GetNameTask");
assert.ok(intake.includes("GetPhoneNumberTask"), "intake uses GetPhoneNumberTask");
assert.ok(intake.includes("GetEmailTask"), "intake uses GetEmailTask");
assert.ok(intake.includes("summarize_chat_ctx=False"), "intake skips TaskGroup summarize pass");

// Phased tools (healthcare update_tools pattern)
assert.ok(amy.includes("update_tools"), "AmyAgent uses dynamic update_tools");
assert.ok(tools.includes("BookingIntakeTask"), "start_booking uses AgentTask wrapper");
assert.ok(
  tools.includes("expose_availability_tools"),
  "start_booking hands off to availability phase (not inline availability in one tool)",
);

// Hotel BookRoomTask-style AgentTask wrapper
const bookingIntakeTask = readSms("voice-runtime-python/transovo_voice/workflows/booking_intake_task.py");
assert.ok(bookingIntakeTask.includes("class BookingIntakeTask(AgentTask"), "BookingIntakeTask is AgentTask");

// EndCallTool (healthcare)
assert.ok(tools.includes("EndCallTool"), "tools include EndCallTool");

// Frontdesk: disallow_interruptions on confirmation speech
assert.ok(tools.includes("disallow_interruptions"), "confirm_booking uses disallow_interruptions before speech");

const telephonyAudio = readSms("voice-runtime-python/transovo_voice/session/telephony_audio.py");
assert.ok(telephonyAudio.includes("BVCTelephony"), "telephony audio uses BVCTelephony noise cancellation");
assert.ok(
  inbound.includes("build_telephony_room_options"),
  "inbound wires telephony room options",
);

// No TS legacy collection orchestration in Python
assert.ok(!intake.includes("responseOwner"), "no TS responseOwner port");
assert.ok(!intake.includes("awaitingFieldAnswer"), "no TS awaitingFieldAnswer port");
assert.ok(!tools.includes("extract_fields"), "no opportunistic extract_fields hot path");

// Examples we intentionally differ from (documented)
if (survey) {
  assert.ok(
    survey.includes("delete_room_on_close=True"),
    "survey example deletes room on close — we gate on transfer capability",
  );
}

if (frontdesk) {
  assert.ok(frontdesk.includes("await ctx.connect()"), "frontdesk connects before session");
}

const hotelBook = readAgents("examples/hotel_receptionist/book_room.py");
if (hotelBook) {
  assert.ok(hotelBook.includes("AgentTask"), "hotel book_room uses AgentTask");
}

if (healthcare) {
  assert.ok(healthcare.includes("WarmTransferTask"), "healthcare uses WarmTransferTask");
}

console.log("test-python-voice-examples-alignment: PASS");
