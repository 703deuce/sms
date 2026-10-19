#!/usr/bin/env node
/**
 * Native Voice V3 runtime checks — no monolith bundle artifacts.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

checks.push([
  "no monolith bundle artifact",
  !existsSync(path.join(root, "lib/server/receptionist/runtime/voice-v3-runtime.bundle.mjs")),
]);
checks.push([
  "no voice-v3-bridge",
  !existsSync(path.join(root, "lib/server/receptionist/runtime/voice-v3-bridge.ts")),
]);
checks.push([
  "native execute-tool present",
  existsSync(path.join(root, "lib/server/voice-v3/execute-tool.ts")),
]);
checks.push([
  "native resolve-session present",
  existsSync(path.join(root, "lib/server/voice-v3/resolve-livekit-session.ts")),
]);

const base = process.env.RECEPTIONIST_TEST_BASE_URL?.trim() || "http://127.0.0.1:3100";
try {
  const res = await fetch(`${base}/api/internal/voice-runtime`);
  const json = await res.json();
  checks.push([
    "voice-runtime native marker",
    res.ok && json.runtime === "native_voice_v3",
  ]);
} catch {
  checks.push(["voice-runtime native marker", false]);
}

console.log(checks.map(([n, ok]) => `${ok ? "PASS" : "FAIL"} ${n}`).join("\n"));
if (!checks.every(([, ok]) => ok)) process.exit(1);
console.log("test-voice-v3-tools: ALL PASS");
