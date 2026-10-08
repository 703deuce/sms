/**
 * Contract: resolve-initiated AR inbound uses persistent multi-appointment routing.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-platform-inbound-session-resolve.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(
  "src/lib/appointment-reminders/messaging/resolve-initiated-ar-inbound.ts",
  "utf8",
);
assert.ok(src.includes("pickPrimaryArReplySessionForInbound"), "primary session picker wired");
assert.ok(src.includes("ambiguous_workspace"), "cross-workspace ambiguity preserved");
assert.ok(!src.includes("expireStaleArReplySessionsExcept"), "must not expire sibling appointments on inbound");

console.log("PASS test-ar-platform-inbound-session-resolve");
