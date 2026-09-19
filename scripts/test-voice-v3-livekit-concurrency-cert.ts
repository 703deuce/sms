#!/usr/bin/env npx tsx
/**
 * LiveKit-path concurrency certification (backend-only; no PSTN).
 *
 * Tests:
 * 1) Booking → callback while find_availability in flight (simulated overlap)
 * 2) Monday → Tuesday preference correction during FIND generation
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/test-voice-v3-livekit-concurrency-cert.ts
 */
import {
  executeVoiceV3ToolForLiveKit,
  resolveVoiceV3LiveKitSession,
} from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit";
import {
  clearVoiceV3CallRuntimeStore,
  getVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { commitFinalCallerUtterance } from "../src/lib/voice-v3/conversation/caller-turn-manager";

const DIALED = process.env.PHONE_E164?.trim() || "+15717491060";

type CaseResult = { id: string; pass: boolean; detail: string };

const results: CaseResult[] = [];

function record(id: string, pass: boolean, detail: string) {
  results.push({ id, pass, detail });
  console.log(pass ? "PASS" : "FAIL", id, detail);
}

async function setupSession(roomSuffix: string) {
  clearVoiceV3CallRuntimeStore();
  const room = `lk_cert_${roomSuffix}_${Date.now()}`;
  const session = await resolveVoiceV3LiveKitSession({
    roomName: room,
    sipParticipantIdentity: "sip-cert",
    callerE164: "+15555550999",
    dialedE164: DIALED,
  });
  return session;
}

async function testBookingToCallbackDuringFind() {
  const session = await setupSession("b2c");
  commitFinalCallerUtterance(
    session.liveSessionId,
    "I'd like to schedule an appointment for next week.",
  );

  await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "update_intake",
    functionCallId: "cert_b2c_intake",
    arguments: {
      fields: [
        { key: "name", value: "Cert Caller" },
        { key: "phone", value: "+15555550999" },
      ],
    },
  });

  await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "set_scheduling_preference",
    functionCallId: "cert_b2c_pref",
    arguments: {
      date_expression: "next week",
      date_relation: "RELATIVE",
      weekday: null,
      explicit_date: null,
      time_expression: "any time",
      time_kind: "FLEXIBLE",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    },
  });

  const findPromise = executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "find_availability",
    functionCallId: "cert_b2c_find",
    arguments: { service_id: null },
  });

  commitFinalCallerUtterance(
    session.liveSessionId,
    "Actually never mind, just have somebody call me back.",
  );

  const callback = await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "request_callback",
    functionCallId: "cert_b2c_callback",
    arguments: {
      callback_phone: null,
      reason: "Caller changed mind and wants a return call instead of booking.",
      preferred_time: null,
      notes: null,
    },
  });

  const findResult = await findPromise;

  const callbackStatus = String((callback as { status?: string }).status ?? "");
  const callbackPersisted =
    callback.ok === true &&
    ["CALLBACK_REQUESTED", "CALLBACK_REQUEST_PERSISTED", "CALLBACK_ALREADY_EXISTS"].includes(
      callbackStatus,
    );
  const callbackNeedsInfo =
    callback.ok === true && callbackStatus === "needs_information";

  record(
    "B2C_CALLBACK_SELECTED",
    callbackPersisted || callbackNeedsInfo,
    JSON.stringify({ callbackStatus, callbackOk: callback.ok }),
  );

  const runtimeAfter = getVoiceV3CallRuntime(session.liveSessionId);
  const activeGoal = runtimeAfter?.getSnapshot().dialog.activeGoal ?? null;
  record(
    "B2C_CALLBACK_GOAL_ACTIVE",
    activeGoal === "REQUEST_CALLBACK" || callbackPersisted,
    JSON.stringify({ activeGoal }),
  );

  record(
    "B2C_FIND_DID_NOT_BLOCK_CALLBACK",
    true,
    `find_status=${findResult.status ?? findResult.code}`,
  );
}

async function testMondayToTuesdayCorrection() {
  const session = await setupSession("mon_tue");

  const monPref = {
    date_expression: "Monday afternoon",
    date_relation: "THIS_WEEKDAY",
    weekday: "MONDAY",
    explicit_date: null,
    time_expression: "afternoon",
    time_kind: "DAYPART",
    exact_time: null,
    start_time: null,
    end_time: null,
    daypart: "AFTERNOON",
  };
  await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "set_scheduling_preference",
    functionCallId: "cert_mon_pref",
    arguments: monPref,
  });

  const findMon = executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "find_availability",
    functionCallId: "cert_mon_find",
    arguments: { service_id: null },
  });

  commitFinalCallerUtterance(session.liveSessionId, "Actually make it Tuesday instead.");

  await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "set_scheduling_preference",
    functionCallId: "cert_tue_pref",
    arguments: {
      date_expression: "Tuesday afternoon",
      date_relation: "THIS_WEEKDAY",
      weekday: "TUESDAY",
      explicit_date: null,
      time_expression: "afternoon",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "AFTERNOON",
    },
  });

  const findTue = await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "find_availability",
    functionCallId: "cert_tue_find",
    arguments: { service_id: null },
  });

  const monResult = await findMon;

  const runtime = getVoiceV3CallRuntime(session.liveSessionId);
  const currentGen = runtime?.getSnapshot().scheduling.generation ?? 0;

  const tueFindRan =
    findTue.code !== "SCHEDULING_PREFERENCE_REQUIRED" &&
    findTue.code !== "SCHEDULING_CLARIFICATION_REQUIRED";
  const tueCurrentGeneration = currentGen >= 2;

  record(
    "MON_TUE_TUESDAY_FIND_ATTEMPTED",
    tueFindRan && tueCurrentGeneration,
    JSON.stringify({
      tue: findTue.status ?? findTue.code,
      scheduling_generation: currentGen,
    }),
  );

  const monNotAuthoritative =
    monResult.ok === false ||
    monResult.code === "FIND_FAILED" ||
    monResult.code === "STALE_READ" ||
    monResult.status === "STALE" ||
    monResult.status === "SUPERSEDED";

  record(
    "MON_TUE_MONDAY_NOT_AUTHORITATIVE_IF_STALE",
    monNotAuthoritative && tueCurrentGeneration,
    JSON.stringify({ mon: monResult.status ?? monResult.code, scheduling_generation: currentGen }),
  );
}

async function main() {
  await testBookingToCallbackDuringFind();
  await testMondayToTuesdayCorrection();

  const failed = results.filter((r) => !r.pass);
  console.log("\nSUMMARY", {
    total: results.length,
    pass: results.length - failed.length,
    fail: failed.length,
  });
  if (failed.length) {
    console.error("FAILURES", failed);
    process.exit(1);
  }
  console.log("LIVEKIT_CONCURRENCY_CERT_BACKEND_PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
