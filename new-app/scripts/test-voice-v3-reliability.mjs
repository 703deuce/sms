/**
 * Focused reliability checks (no full build, no PSTN).
 * Run: node new-app/scripts/test-voice-v3-reliability.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

// 1 — no silent voiceCall.create swallow
const resolveSession = read("lib/server/voice-v3/resolve-livekit-session.ts");
assert.ok(
  resolveSession.includes("ensureVoiceCallRowOnSessionResolve"),
  "session resolve uses ensureVoiceCallRowOnSessionResolve",
);
assert.ok(
  !resolveSession.includes(".catch(() => undefined)") ||
    !resolveSession.match(/voiceCall[\s\S]*?\.catch\(\(\) => undefined\)/),
  "voiceCall create must not use silent catch",
);

const ensureRow = read("lib/server/voice-v3/post-call/ensure-voice-call-row.ts");
assert.ok(ensureRow.includes("VOICE_V3_CALL_ROW_CREATE_FAILED"), "create failures logged");

// 2 — flush wires finalize (not enqueueJob stub)
const forensicsBridge = read(
  "lib/server/voice-v3/python-runtime-bridge/voice-v3-forensics-bridge.ts",
);
assert.ok(forensicsBridge.includes("runVoiceV3FlushFinalize"), "flush calls runVoiceV3FlushFinalize");
assert.ok(forensicsBridge.includes("VOICE_V3_FLUSH_FINALIZE_OK"), "finalize success logged");

const flushFinalize = read("lib/server/voice-v3/post-call/run-flush-finalize.ts");
assert.ok(
  flushFinalize.includes("runVoiceV3PostCallAfterFinalize"),
  "flush finalize runs golden post-call side effects",
);

// 3 — take_message independent path
const takeTool = read("lib/server/voice-v3/tools/take-message-tool.ts");
assert.ok(takeTool.includes("executeTakeMessage"), "take_message uses executeTakeMessage");
const takeExec = read("lib/server/voice-v3/callback/execute-take-message.ts");
assert.ok(
  !takeExec.includes("callbackRequestsEnabled"),
  "take_message must not gate on callbackRequestsEnabled",
);
assert.ok(takeExec.includes("voice_v3_take_message"), "distinct sourceRoute");

// 4 — ring groups not in IVR picker
const routingEditor = read("components/receptionist/conversational-routing-editor.tsx");
assert.ok(
  !routingEditor.includes("kind: 'ring_group'"),
  "ring groups removed from IVR destination picker",
);

// 5 — SIP REFER vs answered
const transferPy = readFileSync(
  join(root, "..", "voice-runtime-python/transovo_voice/voice_v3/transfer_executor.py"),
  "utf8",
);
assert.ok(transferPy.includes("SIP_REFER_ACCEPTED"), "direct transfer returns SIP_REFER_ACCEPTED");
assert.ok(transferPy.includes("transfer_refer_accepted"), "backend status for refer-only");

const recordOutcome = read("lib/server/voice-v3/transfer/record-transfer-outcome.ts");
assert.ok(
  recordOutcome.includes("transfer_refer_accepted"),
  "new-app records refer_accepted separately",
);

console.log("PASS test-voice-v3-reliability");
