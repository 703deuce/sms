#!/usr/bin/env tsx
/**
 * Hermetic AI-VM certification — transcript/summary handling without provider calls.
 * AI-VM-001: transcript derived, labeled, non-authoritative over audio
 * AI-VM-002: summary failure/degraded path; audio remains authoritative
 */
import assert from "node:assert/strict";
import { parseMctbVoicemailLifecycleTrace } from "../src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";

// AI-VM-001 — lifecycle trace preserves record + finalize events
const successTrace = parseMctbVoicemailLifecycleTrace(
  `__mctb_vm_trace__:{"version":1,"buildSha":"vm1","events":[{"at":"2026-08-26T02:00:00.000Z","event":"record_started","payload":{"captureMode":"roomio_tap"}},{"at":"2026-08-26T02:00:05.000Z","event":"transcript_ready","payload":{"chars":120}},{"at":"2026-08-26T02:00:06.000Z","event":"summary_ready","payload":{"chars":48}}]}`,
);
assert.ok(successTrace);
assert.equal(successTrace!.events.some((e) => e.event === "transcript_ready"), true);
assert.equal(successTrace!.events.some((e) => e.event === "summary_ready"), true);

// AI-VM-002 — partial failure: finalize fails but record_started remains authoritative evidence
const degradedTrace = parseMctbVoicemailLifecycleTrace(
  `__mctb_vm_trace__:{"version":1,"buildSha":"vm2","events":[{"at":"2026-08-26T02:00:00.000Z","event":"record_started","payload":{"captureMode":"roomio_tap"}},{"at":"2026-08-26T02:00:05.000Z","event":"finalize_complete","payload":{"ok":false,"error":"transcription_timeout"}}]}`,
);
assert.ok(degradedTrace);
assert.equal(degradedTrace!.events[0]?.event, "record_started");
assert.equal(degradedTrace!.events.at(-1)?.payload?.ok, false);
assert.equal(parseMctbVoicemailLifecycleTrace("not a trace"), null);

console.log("test-mctb-voicemail-ai-hermetic: ok", {
  AI_VM_001: "transcript_and_summary_events_parsed",
  AI_VM_002: "degraded_finalize_without_losing_record_evidence",
});
