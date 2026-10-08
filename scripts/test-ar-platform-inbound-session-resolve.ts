/**
 * Contract: resolve-initiated AR inbound exports single-winner resolver.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-platform-inbound-session-resolve.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  "src/lib/appointment-reminders/messaging/resolve-initiated-ar-inbound.ts",
  "utf8",
);
assert.ok(src.includes("expireStaleArReplySessionsExcept"), "session dedupe helper wired");
assert.ok(!src.includes('status: "ambiguous"'), "ambiguous routing removed");

console.log("PASS test-ar-platform-inbound-session-resolve");
