/**
 * MCTB 571 SIP end-to-end trace — branch selection, dispatch logging, timeout summary.
 */
import assert from "node:assert/strict";
import { isMctb571SipDiagnosticTarget } from "@/lib/mctb/sip-diagnostic/constants";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  logLivekitDispatchEvaluated,
  logLivekitJobNotDispatched,
  logMctbSipE2eTrace,
} from "@/lib/mctb/sip-diagnostic/e2e-trace";

const SYNTHETIC_CALLER = "+15550001001";
const SYNTHETIC_OTHER_DID = "+15550001002";

function captureConsole(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (msg?: unknown) => {
    if (typeof msg === "string") lines.push(msg);
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

// 571 selects MCTB SIP diagnostic branch
assert.equal(isMctb571SipDiagnosticTarget(MCTB_PLATFORM_DEMO_E164), true);

// other DIDs do not
assert.equal(isMctb571SipDiagnosticTarget(SYNTHETIC_CALLER), false);
assert.equal(isMctb571SipDiagnosticTarget(SYNTHETIC_OTHER_DID), false);

// missing dispatch logs failure
const notDispatchedLines = captureConsole(() => {
  logLivekitJobNotDispatched({
    reason: "DISPATCH_NOT_MATCHED",
    roomName: "room-test",
    participantIdentity: "sip-caller",
    toE164: MCTB_PLATFORM_DEMO_E164,
    correlationId: "test-call-id@telnyx",
  });
});
assert.equal(notDispatchedLines.length, 1);
const notDispatched = JSON.parse(notDispatchedLines[0]!);
assert.equal(notDispatched.event, "livekit_job_not_dispatched");
assert.equal(notDispatched.reason, "DISPATCH_NOT_MATCHED");
assert.equal(notDispatched.correlationId, "test-call-id@telnyx");

// dispatch evaluated for 571
const dispatchLines = captureConsole(() => {
  logLivekitDispatchEvaluated({
    toE164: MCTB_PLATFORM_DEMO_E164,
    fromE164: SYNTHETIC_CALLER,
    matched: true,
    dispatchTarget: "transovo-voice-runtime",
    agentName: "transovo-voice-runtime",
    correlationId: "test-call-id@telnyx",
  });
});
const dispatch = JSON.parse(dispatchLines[0]!);
assert.equal(dispatch.event, "livekit_dispatch_evaluated");
assert.equal(dispatch.mctb_sip_route_selected, true);
assert.equal(dispatch.matched, true);

// job receipt style log
const jobLines = captureConsole(() => {
  logMctbSipE2eTrace({
    event: "worker_job_received",
    correlationId: "test-call-id@telnyx",
    jobId: "job-123",
    roomName: "room-test",
    participantIdentity: "sip-caller",
  });
});
const job = JSON.parse(jobLines[0]!);
assert.equal(job.event, "worker_job_received");
assert.equal(job.source, "mctb-sip-e2e");

// timeout summary identifies last successful stage
const summaryLines = captureConsole(() => {
  logMctbSipE2eTrace({
    event: "call_trace_summary",
    correlationId: "test-call-id@telnyx",
    stages: {
      telnyxInboundMs: 0,
      livekitSipReceivedMs: 120,
      dispatchMs: -1,
      participantJoinedMs: -1,
      jobDispatchedMs: -1,
      workerReceivedMs: -1,
      roomConnectedMs: -1,
      audioStartedMs: -1,
    },
    lastSuccessfulStage: "livekitSipReceived",
    failureStage: "dispatch",
    failureReason: "DISPATCH_NOT_MATCHED",
  });
});
const summary = JSON.parse(summaryLines[0]!);
assert.equal(summary.event, "call_trace_summary");
assert.equal(summary.lastSuccessfulStage, "livekitSipReceived");
assert.equal(summary.failureReason, "DISPATCH_NOT_MATCHED");

console.log("test-mctb-sip-e2e-trace: PASS");
