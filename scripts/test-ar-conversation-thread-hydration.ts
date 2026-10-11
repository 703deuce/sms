/**
 * AR conversation thread — merge + ledger idempotency prefix contracts.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-conversation-thread-hydration.ts
 */
import assert from "node:assert/strict";
import { mergeArConversationThreadMessages } from "../src/lib/appointment-reminders/ar-conversation-thread-hydration";
import { AR_SMS_IDEMPOTENCY_PREFIX } from "../src/lib/appointment-reminders/messaging/constants";

function main() {
  const prefix = `${AR_SMS_IDEMPOTENCY_PREFIX}reminder:ws1:appt1:`;
  assert.ok(prefix.startsWith("ar:reminder:"));

  const persisted = [
    {
      id: "in1",
      direction: "inbound" as const,
      body: "R",
      createdAt: "2026-10-11T18:01:00.000Z",
      label: "Customer",
    },
    {
      id: "out1",
      direction: "outbound" as const,
      body: "Thanks, you're confirmed.",
      createdAt: "2026-10-11T18:01:30.000Z",
      label: "Sent by Transovo",
      providerMessageId: "msg-prov-2",
    },
  ];

  const merged = mergeArConversationThreadMessages(persisted, [
    {
      id: "ledger:1",
      body: "Reminder: Appt tomorrow 9am",
      createdAt: new Date("2026-10-11T18:00:00.000Z"),
      providerMessageId: "msg-prov-1",
    },
  ]);

  assert.equal(merged.length, 3);
  assert.equal(merged[0].body, "Reminder: Appt tomorrow 9am");
  assert.equal(merged[1].body, "R");
  assert.equal(merged[2].body, "Thanks, you're confirmed.");

  const deduped = mergeArConversationThreadMessages(persisted, [
    {
      id: "ledger:dup",
      body: "duplicate",
      createdAt: new Date("2026-10-11T17:59:00.000Z"),
      providerMessageId: "msg-prov-2",
    },
  ]);
  assert.equal(deduped.length, 2);

  console.log("test-ar-conversation-thread-hydration: PASS");
}

main();
