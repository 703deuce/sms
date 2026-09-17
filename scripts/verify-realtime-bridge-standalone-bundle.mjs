#!/usr/bin/env node
/**
 * Fail CI/build if production bundle still binds bridge port from Next (EADDRINUSE class bug).
 * Run after `next build` when standalone output exists.
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const chunkDir = path.join(repoRoot, ".next", "standalone", ".next", "server", "chunks");
const startOnCall = path.join(
  repoRoot,
  ".next",
  "standalone",
  "src",
  "lib",
  "voice",
  "telnyx",
  "openai-realtime-bridge",
  "start-on-call.ts",
);

function fail(msg) {
  console.error(`[verify-realtime-bridge-bundle] FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(chunkDir)) {
  console.log("[verify-realtime-bridge-bundle] SKIP — no standalone chunks (dev build?)");
  process.exit(0);
}

if (fs.existsSync(startOnCall)) {
  const src = fs.readFileSync(startOnCall, "utf8");
  if (
    src.includes("startTelnyxRealtimeBridgeServer()") ||
    src.includes("ensureTelnyxRealtimeBridgeServer()")
  ) {
    fail("start-on-call.ts must not start the bridge WSS from Next.js");
  }
}

let badChunk = null;
for (const name of fs.readdirSync(chunkDir)) {
  if (!name.endsWith(".js")) continue;
  const s = fs.readFileSync(path.join(chunkDir, name), "utf8");
  if (!s.includes("startOpenAiRealtimeMediaBridgeOnCall")) continue;
  if (s.includes("await ab(),")) {
    badChunk = name;
    break;
  }
}

if (badChunk) {
  fail(`chunk ${badChunk} still calls await ab() before streaming_start (port 3108 collision)`);
}

console.log("[verify-realtime-bridge-bundle] OK");
