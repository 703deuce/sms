/**
 * Hermetic tests for MCTB voicemail lifecycle persistence.
 * Run: npx tsx scripts/test-mctb-voicemail-lifecycle.ts
 */
import assert from "node:assert/strict";
import { parseMctbVoicemailLifecycleTrace } from "../src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle-trace";

const sample = `__mctb_vm_trace__:{"version":1,"buildSha":"abc123","events":[{"at":"2026-08-26T02:00:00.000Z","event":"record_started","payload":{"captureMode":"roomio_tap"}},{"at":"2026-08-26T02:00:05.000Z","event":"finalize_complete","payload":{"ok":false}}]}`;

const parsed = parseMctbVoicemailLifecycleTrace(sample);
assert.ok(parsed);
assert.equal(parsed?.buildSha, "abc123");
assert.equal(parsed?.events.length, 2);
assert.equal(parsed?.events[0]?.event, "record_started");
assert.equal(parseMctbVoicemailLifecycleTrace("plain notes"), null);

console.log("test-mctb-voicemail-lifecycle: ok");
