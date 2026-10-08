/**
 * Static contract checks for shared AR sender allocation boundaries.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-sender-allocation-contract.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assignment = readFileSync(
  "src/lib/appointment-reminders/messaging/ar-consumer-platform-sender-assignment.ts",
  "utf8",
);
const replySession = readFileSync(
  "src/lib/appointment-reminders/messaging/reply-session.ts",
  "utf8",
);

assert.ok(
  assignment.includes("materializeLegacyArSenderAssignmentsForConsumer"),
  "legacy materialize before allocation",
);
assert.ok(assignment.includes('code === "P2002"'), "retry on unique violation");
assert.ok(assignment.includes("occupiedByOthers.add"), "mark contested sender and continue loop");
assert.ok(
  assignment.includes("ar_assigned_sender_unavailable"),
  "block silent sender rotation when assigned sender unauthorized",
);
assert.ok(
  replySession.includes("ar_assigned_sender_unavailable"),
  "selectArOutbound does not bypass unavailable assignment",
);
const selectBlock = replySession.match(
  /export async function selectArOutboundPlatformSender[\s\S]*?^}/m,
)?.[0];
assert.ok(selectBlock && !selectBlock.includes("expireSupersededArReplySessionsOnSender"), {
  message: "selectArOutbound does not call expireSuperseded (no latest-reminder-wins)",
});

console.log("PASS test-ar-sender-allocation-contract");
